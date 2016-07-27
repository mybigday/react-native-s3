import React, {
	AppRegistry,
	Component,
	StyleSheet,
	Text,
	View,
	ScrollView,
	TouchableHighlight,
	DeviceEventEmitter
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


// aws access keys and region
const options = {
	"access_key": "xxxx",
	"secret_key": "xxxxxxxxxxxxx",
	"region": "us-east-1",
}

const sampleVideoURL = "http://www.sample-videos.com/video/mp4/720/big_buck_bunny_720p_1mb.mp4";

class S3Sample extends Component {
	constructor(props) {
		super(props);

		this.state = {
			initLoaded: false,
			logText: "",
		};
	}

	async componentDidMount() {
		if (!this.state.initLoaded) {
			if (!await fs.exists(uploadFilePath)) {
				await fs.downloadFile(sampleVideoURL, uploadFilePath).then(res => {
				    fs.readDir(fs.DocumentDirectoryPath)
				    .then((result) => {
					    // Confirm that the file was written
					});
				});
			}

			// Set up with basic options set, or with options set in the native code
			await transferUtility.setupWithBasic(options, subscribeProgress);

			const uploadTasks = await transferUtility.getTasks("upload", true);
			const downloadTasks = await transferUtility.getTasks("download", true);

			DeviceEventEmitter.addListener('State_Changed', result => this.handleEvent('State_Changed', result));
    		DeviceEventEmitter.addListener('Progress_Changed', result => this.handleEvent('Progress_Changed', result));
			DeviceEventEmitter.addListener('Error', result => this.handleEvent('Error', result));

			for (const id in uploadTasks) {
				this.subscribeWithUpdateState(id, "uploadTasks");
			}
			for (const id in downloadTasks) {
				this.subscribeWithUpdateState(id, "downloadTasks");
			}

			this.setState({ initLoaded: true, logText: "Press Download or Upload to begin \n" });
		}
	}

	handleEvent = (eventType, result) => {
		switch(eventType) {
			case 'State_Changed':
				if (result.task.state == 'completed' && transferAction == 'Download') {
					this.setState({ logText: `${ this.state.logText }State_Changed: ${ result.task.state } \nDownload complete \nFile location: ${ fs.DocumentDirectoryPath }` });	
				} else if (result.task.state == 'completed' && transferAction == 'Upload') {
					this.setState({ logText: `${ this.state.logText }State_Changed: ${ result.task.state } \nUpload complete \ns3 file location: ${ bucketName }/${ uploadFileKey }` });	
				} else { this.setState({ logText: `${ this.state.logText }State_Changed: ${ result.task.state } \n` }); }
				break;
			case 'Progress_Changed':
				this.setState({ logText: `${ this.state.logText }Progress_Changed: ${ result.task.bytes/result.task.totalBytes * 100 }% \n` });
				break;
			case 'Error':
				this.setState({ logText: `${ this.state.logText }Error: ${ result.error } \n\n` });
				break;
			default: 
				console.warn("Receiving event that doesn't match case");
				break;
		}		
	};

	subscribeWithUpdateState = (id, typeKey) => {
		transferUtility.subscribe(id, (err, task) => {
			if (err) task.errMessage = err;
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
			}
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
			}
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
			<View style={ styles.container }>
				<TouchableHighlight onPress={this.handleDownloadFile}>
					<Text style={styles.btn}>Download Designated File</Text>
				</TouchableHighlight>
				<TouchableHighlight onPress={this.handleUploadFile}>
					<Text style={styles.btn}>Upload Designated File</Text>
				</TouchableHighlight>
				<ScrollView 
		        ref='scrollView'
		        style={ styles.logContainer }
		        onContentSizeChange={ (width, height) => { this.refs.scrollView.scrollTo({ y: height }) } }>
		            <Text
		            style={ styles.logText }>
		                { this.state.logText }
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
		alignItems: 'center',
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
	    alignItems: 'center',
	    paddingBottom: 20,
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
	    borderColor: 'black',
	    paddingHorizontal: 10,
	    borderStyle: 'solid',
	    backgroundColor: 'lavender',
	},
});

AppRegistry.registerComponent("S3Sample", () => S3Sample);
