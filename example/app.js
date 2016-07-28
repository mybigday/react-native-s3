import React, {
	AppRegistry,
	Component,
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableHighlight
} from "react-native";
import { transferUtility } from "react-native-s3";
import fs from "react-native-fs";

const bucketName = ""; // name of bucket
const uploadFileKey = "ReactNativeTest/test.mp4"; // path to file in s3, excluding bucket
const contentType = "image/jpeg"; // type of file
const uploadFilePath = fs.DocumentDirectoryPath + "/test.mp4"; // file to be uploaded
const downloadFileKey = "ReactNativeTest/hello_world.png"; // path to file in s3, excluding bucket
const downloadFilePath = fs.DocumentDirectoryPath + "/blah.png"; // path to where file should be downloaded to

const subscribeProgress = true; // Change to false if you don't want to subscribe to progress events
var transferAction = "";


// aws cognito options
const cognitoOptions = {
	"region": "us-east-1",
	"identity_pool_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
	"cognito_region": "us-east-1",
	"caching": true
};

// aws access keys and region options for basic s3 use
// const keySecretOptions = {
// 	"access_key": "xxxx",
// 	"secret_key": "xxxxxxxxxxxxx",
// 	"region": "us-east-1"
// };

const sampleVideoURL = "http://www.sample-videos.com/video/mp4/720/big_buck_bunny_720p_1mb.mp4";

class S3Sample extends Component {
	constructor(props) {
		super(props);

		this.state = {
			initLoaded: false,
			logText: ""
		};
	}

	async componentDidMount() {
		if (!this.state.initLoaded) {
			if (!await fs.exists(uploadFilePath)) {
				await fs.downloadFile(sampleVideoURL, uploadFilePath).then(() => {
					fs.readDir(fs.DocumentDirectoryPath)
					.then((result) => {
						// Confirm that the file was written
						console.log(result);
					});
				});
			}

			// Set up with cognito options
			await transferUtility.setupWithCognito(cognitoOptions, subscribeProgress);

			// Set up with basic (standard) options
			// await transferUtility.setupWithBasic(keySecretOptions, subscribeProgress);

			const uploadTasks = await transferUtility.getTasks("upload", true);
			const downloadTasks = await transferUtility.getTasks("download", true);

			for (const id in uploadTasks) {
				this.subscribeWithUpdateState(id, "uploadTasks");
			}
			for (const id in downloadTasks) {
				this.subscribeWithUpdateState(id, "downloadTasks");
			}

			this.setState({ initLoaded: true, logText: "Press Download or Upload to begin \n" });
		}
	}

	handleEvent = (eventType, task) => {
		switch(eventType) {
		case "@_RNS3_State_Changed":
			if (task.state == "completed" && transferAction == "Download") {
				this.setState({ logText: `${ this.state.logText }State_Changed: ${ task.state } \nDownload complete \nFile location: ${ fs.DocumentDirectoryPath }` });	
			} else if (task.state == "completed" && transferAction == "Upload") {
				this.setState({ logText: `${ this.state.logText }State_Changed: ${ task.state } \nUpload complete \ns3 file location: ${ bucketName }/${ uploadFileKey }` });	
			} else { this.setState({ logText: `${ this.state.logText }State_Changed: ${ task.state } \n` }); }
			break;
		case "@_RNS3_Progress_Changed":
			this.setState({ logText: `${ this.state.logText }Progress_Changed: ${ task.bytes/task.totalBytes * 100 }% \n` });
			break;
		case "@_RNS3_Error":
			this.setState({ logText: `${ this.state.logText }Error: ${ task.errMessage } \n\n` });
			break;
		default: 
			console.warn("Receiving event that doesn't match case");
			break;
		}		
	};

	subscribeWithUpdateState = (id, typeKey) => {
		transferUtility.subscribe(id, (err, task) => {
			if (err != undefined) task.errMessage = err;
			this.handleEvent(task.eventIdentifier, task);
			this.setState({
				[typeKey]: {
					...this.state[typeKey],
					...{ [task.id]: task }
				}
			});
		});
	};

	handleUploadFile = async () => {
		transferAction = "Upload";
		const task = await transferUtility.upload({
			bucket: bucketName,
			key: uploadFileKey,
			file: uploadFilePath,
			meta: {
				contentType
			}
		});
		this.setState({
			uploadTasks: {
				...this.state.uploadTasks,
				...{ [task.id]: task }
			},
			logText: `${ this.state.logText }\nUpload Started To s3 Location:\n${ bucketName }/${ uploadFileKey } \n\n`
		});
		this.subscribeWithUpdateState(task.id, "uploadTasks");
	};

	handleDownloadFile = async () => {
		transferAction = "Download";
		const task = await transferUtility.download({
			bucket: bucketName,
			key: downloadFileKey,
			file: downloadFilePath
		});
		this.setState({
			downloadTasks: {
				...this.state.downloadTasks,
				...{ [task.id]: task }
			},
			logText: `${ this.state.logText }\nDownload Started For File At s3 Location:\n${ bucketName }/${ downloadFileKey } \n\n`
		});
		this.subscribeWithUpdateState(task.id, "downloadTasks");
	};

	pauseTask(id) {
		transferUtility.pause(id);
	}

	cancelTask(id) {
		transferUtility.cancel(id);
	}

	// Android only
/*	removeTask(id) {
		transferUtility.deleteRecord(id);
		this.setState({
			[typeKey]: {
				...this.state[typeKey],
				...{ [task.id]: undefined }
			}
		});
	}*/

	resumeTask(id) {
		transferUtility.resume(id);
	}

	render() {
		return (
			<View style={styles.container}>
				<TouchableHighlight onPress={this.handleDownloadFile}>
					<Text style={styles.btn}>{"Download Designated File"}</Text>
				</TouchableHighlight>
				<TouchableHighlight onPress={this.handleUploadFile}>
					<Text style={styles.btn}>{"Upload Designated File"}</Text>
				</TouchableHighlight>
				<ScrollView 
					ref="scrollView"
					style={styles.logContainer}
					onContentSizeChange={(width, height) => {this.refs.scrollView.scrollTo({ y: height });}}>
					<Text
						style={styles.logText}>
						{this.state.logText}
					</Text>
				</ScrollView>
			</View>
		);
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		marginTop: 20,
		alignItems: "center",
		backgroundColor: "#F5FCFF"
	},
	title: {
		fontSize: 20,
		textAlign: "center",
		margin: 10
	},
	task: {
		flexDirection: "row",
		justifyContent: "center"
	},
	logText: {
		alignItems: "center",
		paddingBottom: 20
	},
	text: {
		fontSize: 12,
		textAlign: "center",
		margin: 10
	},
	btn: {
		fontSize: 15,
		textAlign: "center",
		margin: 10
	},
	logContainer: {
		flex: 1,
		width: 350,
		marginBottom: 10,
		borderWidth: 2,
		borderRadius: 5,
		borderColor: "black",
		paddingHorizontal: 10,
		borderStyle: "solid",
		backgroundColor: "lavender"
	}
});

AppRegistry.registerComponent("S3Sample", () => S3Sample);
