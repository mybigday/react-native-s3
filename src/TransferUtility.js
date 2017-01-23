import { NativeModules, NativeAppEventEmitter, DeviceEventEmitter, Platform } from "react-native";
import store from "react-native-simple-store";
import { normalizeFilePath, snakeCaseKeys } from "./utils";

const { RNS3TransferUtility } = NativeModules;

const transferTypes = ["upload", "download"];
const defaultOptions = {
	remember_last_instance: true,
	region: "eu-west-1"
};
const defaultCognitoOptions = {
	...defaultOptions,
	cognito_region: "eu-west-1"
};
const storeKey = "@_RNS3_Tasks_Extra";
/*
 * taskExtra: 
 *	 [id]:
 *		 iOS: { bucket, key, state, bytes, totalBytes }
 *		 Android: { bucket, key, bytes }
 */
let taskExtras;
const listeners = {};	// [id]: [Function, ...]

let EventEmitter;
if (Platform.OS === "ios") {
	EventEmitter = NativeAppEventEmitter;
} else if (Platform.OS === "android") {
	EventEmitter = DeviceEventEmitter;
}

EventEmitter.addListener("@_RNS3_Events", async event => {
	if (!taskExtras) await getTaskExtras();
	const { task, error } = event;

	let finalTask = task;
	if (Platform.OS === "ios") {
		const { state, bytes, totalBytes } = task;
		finalTask = await setTaskExtra(task, { state, bytes, totalBytes });
	} else if (Platform.OS === "android") {
		const { bytes } = task;
		finalTask = await setTaskExtra(task, { bytes });
	}
	if (listeners[task.id]) {
		listeners[task.id].forEach(cb => cb(error, finalTask));
	}
});

async function getTaskExtras() {
	try {
		// https://github.com/lelandrichardson/react-native-mock/pull/106
		taskExtras = await store.get(storeKey) || {};
	} catch (e) {
		taskExtras = {};
	}
	return taskExtras;
}

function putExtra(task) {
	if (!taskExtras[task.id]) return task;
	return { ...task, ...taskExtras[task.id] };
}

function saveTaskExtras() {
	return store.save(storeKey, taskExtras);
}

async function setTaskExtra(task, values, isNew) {
	const { id } = task;
	if (!taskExtras[id] || isNew) {
		taskExtras[id] = values;
	} else {
		if (Platform.OS === "ios") {
			if (taskExtras[id].bytes && !values.bytes) {
				taskExtras[id] = { ...taskExtras[id], state: values.state };
			} else {
				taskExtras[id] = { ...taskExtras[id], ...values };
			}
		} else if (Platform.OS === "android") {
			if (values.bytes) {
				taskExtras[id] = { ...taskExtras[id], ...values };
			}
		}
	}
	await saveTaskExtras();
	return putExtra(task);
}

export default class TransferUtility {
	async setupWithNative() {
		const result = await RNS3TransferUtility.setupWithNative();
		if (result) {
			await getTaskExtras();
			RNS3TransferUtility.initializeRNS3();
		}
		return result;
	}

	async setupWithBasic(options = {}) {
		const opts = snakeCaseKeys(options);
		if (!opts.access_key || !opts.secret_key) {
			return false;
		}
		if (Platform.OS === "android") {
			opts.session_token = opts.session_token || null;
		}
		const result = await RNS3TransferUtility.setupWithBasic({ ...defaultOptions, ...opts});
		if (result) {
			await getTaskExtras();
			RNS3TransferUtility.initializeRNS3();
		}
		return result;
	}

	async setupWithCognito(options = {}) {
		const opts = snakeCaseKeys(options);
		if (!opts.identity_pool_id) {
			return false;
		}
		const result = await RNS3TransferUtility.setupWithCognito({ ...defaultCognitoOptions, ...opts });
		if (result) {
			await getTaskExtras();
			RNS3TransferUtility.initializeRNS3();
		}
		return result;
	}

	enableProgressSent(enabled) {
		return RNS3TransferUtility.enableProgressSent(enabled);
	}

	async upload(options = {}, others = {}) {
		const opts = snakeCaseKeys(options);
		opts.meta = opts.meta || {};
		const { contentType } = opts.meta;
		if (contentType) {
			opts.meta["Content-Type"] = contentType;
		}
		const task = await RNS3TransferUtility.upload({
			...opts,
			file: normalizeFilePath(opts.file)
		});
		const extra = {
			bucket: opts.bucket,
			key: opts.key,
			others
		};
		if (Platform.OS === "ios") {
			extra.state = task.state;
		}
		const finalTask = await setTaskExtra(task, extra, true);
		return finalTask;
	}

	async download(options = {}, others = {}) {
		const opts = snakeCaseKeys(options);
		const task = await RNS3TransferUtility.download({
			...options,
			file: normalizeFilePath(opts.file)
		});
		const extra = {
			bucket: opts.bucket,
			key: opts.key,
			others
		};
		if (Platform.OS === "ios") {
			extra.state = task.state;
		}
		const finalTask = await setTaskExtra(task, extra, true);
		return finalTask;
	}

	pause(id) {
		RNS3TransferUtility.pause(Number(id));
	}

	resume(id) {
		RNS3TransferUtility.resume(Number(id));
	}

	cancel(id) {
		RNS3TransferUtility.cancel(Number(id));
	}

	// Android only
	async deleteRecord(id) {
		if (Platform.OS === "ios") {
			throw new Error("Not implemented");
		}
		return RNS3TransferUtility.deleteRecord(Number(id));
	}

	async getTask(id) {
		const task = await RNS3TransferUtility.getTask(Number(id));
		if (task) {
			return putExtra(task);
		}
		return null;
	}

	// idAsKey: return Object with id as key
	async getTasks(type = "", idAsKey) {
		if (transferTypes.indexOf(type) > -1) {
			let tasks = await RNS3TransferUtility.getTasks(type);
			tasks = tasks.map(task => putExtra(task));

			if (!idAsKey) return tasks;
			const idAsKeyTasks = {};
			for (const task of tasks) {
				idAsKeyTasks[task.id] = task;
			}
			return idAsKeyTasks;
		}
		return null;
	}

	subscribe(id, eventHandler) {
		if (!taskExtras[id]) return;
		if (!listeners[id]) {
			listeners[id] = [];
		}
		const listenersForTask = listeners[id];
		if (listenersForTask.indexOf(eventHandler) < 0) {
			listenersForTask.push(eventHandler);
		}
	}

	unsubscribe(id, eventHandler) {
		if (!listeners[id]) return;
		if (!eventHandler) {
			delete listeners[id];
			return;
		}
		const listenersForTask = listeners[id];
		const index = listenersForTask.indexOf(eventHandler);
		if (index > 0) {
			listenersForTask.splice(index, 1);
		}
	}
}
