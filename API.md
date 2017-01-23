# API

## Usage

```js
import { transferUtility } from 'react-native-s3';
```

#### `transferUtility.setupWithNative()`

Return: Promise - will resolve arguments:
* Boolean - `true` or `false` depending on the setup successful.

#### `transferUtility.setupWithBasic(options)`

* `options` Object
  * `region` String - a S3 Region (default: eu-west-1)
  * `access_key` String - the AWS access key ID
  * `secret_key` String - the AWS secret access key
  * `session_token` String - (optional)
  * `remember_last_instance` Boolean - keep the last transferUtility instance when JS reload (default: true) __(iOS)__

Return: Promise - will resolve arguments:
* Boolean - `true` or `false` depending on the setup successful.

#### `transferUtility.setupWithCognito(options)`

* `options` Object
  * `region` String - a S3 Region (default: eu-west-1)
  * `identity_pool_id` String - the Amazon Cogntio identity pool
  * `cognito_region` String - a Cognito Region (default: eu-west-1)
  * `caching` Boolean - use `CognitoCachingCredentialsProvider` instead of `CognitoCredentialsProvider` __(Android)__
  * `remember_last_instance` Boolean - keep the last transferUtility instance when JS reload (default: true) __(iOS)__

See AWS CognitoCredentialsProvider ([iOS](http://docs.aws.amazon.com/AWSiOSSDK/latest/Classes/AWSCognitoCredentialsProvider.html)/[Android](http://docs.aws.amazon.com/AWSAndroidSDK/latest/javadoc/com/amazonaws/auth/CognitoCredentialsProvider.html)) for more information.

Return: Promise - will resolve arguments:
* Boolean - `true` or `false` depending on the setup successful.

#### `transferUtility.enableProgressSent(enabled)`

* enabled Boolean - Allow `in_progress` event send to JS runtime. (Default: true)

Return: Promise

#### `transferUtility.upload(options)`

New a upload task.

* `options` Object
  * `bucket` String - a S3 bucket name
  * `key` String - the object key/destination in the bucket
  * `file` String - the file path to upload
  * `meta` Object
    * `Content-Type` String - the file content-type
    * See: [iOS](http://docs.aws.amazon.com/AWSiOSSDK/latest/Classes/AWSS3TransferUtilityExpression.html#//api/name/requestHeaders)/[Android](http://docs.aws.amazon.com/AWSAndroidSDK/latest/javadoc/com/amazonaws/services/s3/model/ObjectMetadata.html#addUserMetadata-java.lang.String-java.lang.String-)

Return: Promise - will resolve, see following arguments:
* Object - a [Task](#the-task-object-structure) object

or reject.

#### `transferUtility.download(options)`

New a download task.

* `options` Object
  * `bucket` String - a S3 bucket name
  * `key` String - the object key/destination in the bucket
  * `file` String - donwload save file path

Return: Promise - will resolve, see following arguments:
* Object - a [Task](#the-task-object-structure) object

or reject.

#### `transferUtility.pause(id)`

* `id` Number - a Task id

#### `transferUtility.resume(id)`

* `id` Number - a Task id

#### `transferUtility.cancel(id)`

* `id` Number - a Task id

#### `transferUtility.deleteRecord(id)` __(Android)__

* `id` Number - a Task id

Return: Promise - will resolve, see following arguments:
* Boolean - `true` or `false` depending on the delete task record successful.

#### `transferUtility.getTask(id)`

Gets a Task object with the given id.

* `id` Number - a Task id

Return: Promise - will resolve, see following arguments:
* Object - a [Task](#the-task-object-structure) object

#### `transferUtility.getTasks(type, idAsKey)`

Gets a Task object list with the type.

* `type` String - enum: `upload`, `download`
* `idAsKey` Boolean - true: return Object with id as key, false: return Array

Return: Promise - will resolve, see following arguments:
* Array - a [Task](#the-task-object-structure) object list

#### `transferUtility.subscribe(id, eventHandler)`

Subscribe the task changes with the given id.

* `id` Number - a Task id
* `eventHandler` Function - arguments:
  * `err` Object - error information object or null if no error 
  * `task` Object - a [Task](#the-task-object-structure) object

#### `transferUtility.unsubscribe(id, eventHandler)`

Unsubscribe task change listener `eventHandler` with the given id.
If `eventHandler` is not exists, it will unsubscribe all task change listeners with the given id.

* `id` Number - a Task id

## The `Task` object structure

```js
{
  id: Number,
  state: String, // task state
  // progress of task: bytes / totalBytes
  bytes: Number,
  totalBytes: Number,
  bucket: String,
  key: String
}
```

It will not be immediately refresh, you must `subscribe` or call `getTask(id)` to replace it.

## The `Task` states

* `waiting`
* `in_progress`
* `paused`
* `canceled`
* `completed`
* `failed`
