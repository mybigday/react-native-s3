import expect from "expect";
import { NativeModules, NativeAppEventEmitter } from "react-native";

let nextTaskId = 0;
let uploadTaskStoreForNative = [];
let downloadTaskStoreForNative = [];

// Set RNS3TransferUtility mock
NativeModules.RNS3TransferUtility = {
	initializeRNS3: () => {},
	setupWithNative: r => r,
	setupWithBasic: r => r,
	setupWithCognito: r => r,
	enableProgressSent: () => {},
	upload: () => {
		const task = {
			id: nextTaskId++,
			state: "waiting"
		};
		uploadTaskStoreForNative.push(task);
		return task;
	},
	download: () => {
		const task = {
			id: nextTaskId++,
			state: "waiting"
		};
		downloadTaskStoreForNative.push(task);
		return task;
	},
	pause: () => {},
	resume: () => {},
	cancel: () => {},
	deleteRecord: () => {},
	getTask: id =>
		uploadTaskStoreForNative[id] || downloadTaskStoreForNative[id],
	getTasks: type =>
		type === "upload" ?
			uploadTaskStoreForNative :
			downloadTaskStoreForNative
};

const { transferUtility } = require("../src");

const delay = time => new Promise(resolve => setTimeout(resolve, time));

describe("TransferUtility", () => {

	before(async () => {
		expect(await transferUtility.setupWithBasic({
			accessKey: "test",
			secretKey: "test"
		})).toEqual({
			remember_last_instance: true,
			region: "eu-west-1",
			access_key: "test",
			secret_key: "test"
		});
	});

	afterEach(() => {
		nextTaskId = 0;
		uploadTaskStoreForNative = [];
		downloadTaskStoreForNative = [];
	});

	it("should get expected task object for upload / download", async () => {
		const uploadTask = await transferUtility.upload({
			file: "file://file",
			bucket: "bucketName",
			key: "key"
		}, { a: 1 });
		expect(uploadTask).toEqual({
			bucket: "bucketName",
			id: 0,
			key: "key",
			others: { a: 1 },
			state: "waiting"
		});

		const downloadTask = await transferUtility.download({
			file: "file://file2",
			bucket: "bucketName2",
			key: "key2"
		}, { a: 1 });
		expect(downloadTask).toEqual({
			bucket: "bucketName2",
			id: 1,
			key: "key2",
			others: { a: 1 },
			state: "waiting"
		});
	});

	it("should get task with getTask(id)", async () => {
		await transferUtility.upload({
			file: "file://file",
			bucket: "bucketName",
			key: "key"
		}, { a: 1 });
		const task = await transferUtility.getTask(0);
		expect(task).toEqual({
			bucket: "bucketName",
			id: 0,
			key: "key",
			others: { a: 1 },
			state: "waiting"
		});
	});

	it("should get tasks with getTasks(type)", async () => {
		await transferUtility.upload({
			file: "file://file",
			bucket: "bucketName",
			key: "key"
		}, { a: 1 });
		await transferUtility.download({
			file: "file://file2",
			bucket: "bucketName2",
			key: "key2"
		}, { a: 1 });

		let tasks = await transferUtility.getTasks("none");
		expect(tasks).toBeNull;

		tasks = await transferUtility.getTasks("upload");
		expect([{
			bucket: "bucketName",
			id: 0,
			key: "key",
			others: { a: 1 },
			state: "waiting"
		}]);
		tasks = await transferUtility.getTasks("download");
		expect([{
			bucket: "bucketName2",
			id: 1,
			key: "key2",
			others: { a: 1 },
			state: "waiting"
		}]);

		// id as key
		tasks = await transferUtility.getTasks("upload", true);
		expect({
			0: {
				bucket: "bucketName",
				id: 0,
				key: "key",
				others: { a: 1 },
				state: "waiting"
			}
		});
		tasks = await transferUtility.getTasks("download", true);
		expect({
			1: {
				bucket: "bucketName2",
				id: 1,
				key: "key2",
				others: { a: 1 },
				state: "waiting"
			}
		});
	});

	it("should can subscribe / unsubscribe tasks", async () => {
		await transferUtility.upload({
			file: "file://file",
			bucket: "bucketName",
			key: "key"
		}, { a: 1 });
		let finalTask;
		const eventHandler = (err, task) => {
			finalTask = task;
		};
		transferUtility.subscribe(0, eventHandler);
		const fakeExtra = {
			state: "fake_state",
			bytes: 10,
			totalBytes: 100
		};
		NativeAppEventEmitter.emit("@_RNS3_Events", {
			task: { id: 0, ...fakeExtra }
		});
		await delay(100);
		expect(finalTask).toEqual({
			id: 0,
			bucket: "bucketName",
			key: "key",
			others: { a: 1 },
			...fakeExtra
		});

		let finalTask2;
		const eventHandler2 = (err, task) => {
			finalTask2 = task;
		};
		await transferUtility.download({
			file: "file://file2",
			bucket: "bucketName2",
			key: "key2"
		}, { a: 1 });
		transferUtility.subscribe(1, eventHandler);
		transferUtility.subscribe(1, eventHandler2);
		NativeAppEventEmitter.emit("@_RNS3_Events", {
			task: { id: 1, ...fakeExtra }
		});
		await delay(100);
		expect(finalTask).toEqual({
			id: 1,
			bucket: "bucketName2",
			key: "key2",
			others: { a: 1 },
			...fakeExtra
		});
		expect(finalTask2).toEqual({
			id: 1,
			bucket: "bucketName2",
			key: "key2",
			others: { a: 1 },
			...fakeExtra
		});

		// unsubscribe eventHandler2
		transferUtility.unsubscribe(1, eventHandler2);
		NativeAppEventEmitter.emit("@_RNS3_Events", {
			task: { id: 1, ...fakeExtra, state: "changed_fake_state" }
		});
		await delay(100);
		expect(finalTask).toEqual({
			id: 1,
			bucket: "bucketName2",
			key: "key2",
			others: { a: 1 },
			...fakeExtra,
			state: "changed_fake_state"
		});
		expect(finalTask2).toEqual({
			id: 1,
			bucket: "bucketName2",
			key: "key2",
			others: { a: 1 },
			...fakeExtra
			// state will not changed
		});
	});
});
