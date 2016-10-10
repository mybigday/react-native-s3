package com.mybigday.rns3;

import java.io.File;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

import android.content.Context;

import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.BasicSessionCredentials;
import com.amazonaws.auth.CognitoCachingCredentialsProvider;
import com.amazonaws.auth.CognitoCredentialsProvider;
import com.amazonaws.regions.Region;
import com.amazonaws.regions.Regions;

import com.amazonaws.services.s3.model.ObjectMetadata;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import com.amazonaws.services.s3.*;
import com.amazonaws.mobileconnectors.s3.transferutility.*;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class RNS3TransferUtility extends ReactContextBaseJavaModule {
  public static enum CredentialType {
    BASIC, COGNITO
  };
  public static final Map<String, Object> nativeCredentialsOptions = new HashMap<String, Object>();

  static {
    // default options
    nativeCredentialsOptions.put("region", "us-east-1");
    nativeCredentialsOptions.put("cognito_region", "eu-west-1");
  }

  private static boolean alreadyInitialize = false;
  private Context context;
  private AmazonS3 s3;
  private TransferUtility transferUtility;
  private Boolean subscribeProgress = true;

  public RNS3TransferUtility(ReactApplicationContext reactContext) {
    super(reactContext);

    this.context = (Context) reactContext;
  }

  @Override
  public String getName() {
    return "RNS3TransferUtility";
  }

  private void sendEvent(String eventName, WritableMap params) {
    ((ReactApplicationContext) this.context)
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }

  private WritableMap convertTransferObserver(TransferObserver task) {
    if (task == null) return null;
    WritableMap taskMap = Arguments.createMap();
    taskMap.putInt("id", task.getId());
    taskMap.putString("state", task.getState().toString().toLowerCase());
    taskMap.putDouble("bytes", task.getBytesTransferred());
    taskMap.putDouble("totalBytes", task.getBytesTotal());
    return taskMap;
  }

  private WritableArray convertTransferObserverList(List<TransferObserver> list) {
    WritableArray taskList = Arguments.createArray();
    if (list == null) return taskList;
    Iterator<TransferObserver> it = list.iterator();
    while (it.hasNext()) {
      TransferObserver task = it.next();
      taskList.pushMap(convertTransferObserver(task));
    }
    return taskList;
  }

  private void subscribe(TransferObserver task) {
    if (task == null) return;
    task.setTransferListener(new TransferListener() {
      @Override
      public void onStateChanged(int id, TransferState state) {
        TransferObserver task = transferUtility.getTransferById(id);
        WritableMap result = Arguments.createMap();
        result.putMap("task", convertTransferObserver(task));
        sendEvent("@_RNS3_State_Changed", result);
      }

      @Override
      public void onProgressChanged(int id, long bytesCurrent, long bytesTotal) {
          if (subscribeProgress == true) {
              TransferObserver task = transferUtility.getTransferById(id);
              WritableMap result = Arguments.createMap();
              WritableMap taskMap = convertTransferObserver(task);
              if (taskMap.getDouble("bytes") <= bytesTotal) {
                taskMap.putDouble("bytes", bytesCurrent);
              }
              result.putMap("task", taskMap);
              sendEvent("@_RNS3_Progress_Changed", result);
          }
      }

      @Override
      public void onError(int id, Exception ex) {
        TransferObserver task = transferUtility.getTransferById(id);
        WritableMap result = Arguments.createMap();
        result.putMap("task", convertTransferObserver(task));
        result.putString("error", ex.getMessage());
        sendEvent("@_RNS3_Error", result);
      }
    });
  }

  private void subscribeList(List<TransferObserver> tasks) {
    if (tasks == null) return;
    Iterator<TransferObserver> it = tasks.iterator();
    while (it.hasNext()) {
      TransferObserver task = it.next();
      subscribe(task);
    }
  }

  private boolean setup(Map<String, Object> credentialsOptions) {
    String regionStr = (String) credentialsOptions.get("region");
    Region region = Region.getRegion(Regions.fromName(regionStr));
    AWSCredentials credentials = null;
    AWSCredentialsProvider credentialsProvider = null;
    switch ((CredentialType) credentialsOptions.get("type")) {
      case BASIC:
        String sessionToken = (String) credentialsOptions.get("session_token");
        if (sessionToken != null) {
          credentials = new BasicSessionCredentials(
            (String) credentialsOptions.get("access_key"),
            (String) credentialsOptions.get("secret_key"),
            sessionToken
          );
        } else {
          credentials = new BasicAWSCredentials(
            (String) credentialsOptions.get("access_key"),
            (String) credentialsOptions.get("secret_key")
          );
        }
        break;
      // TODO: support accountId, unauthRoleArn, authRoleArn
      case COGNITO:   
        String cognitoRegion = (String) credentialsOptions.get("cognito_region");
        if (!(Boolean) credentialsOptions.get("caching")) {
          credentialsProvider = new CognitoCredentialsProvider(
            (String) credentialsOptions.get("identity_pool_id"),
            Regions.fromName(cognitoRegion)
          );
        } else {        
          credentialsProvider = new CognitoCachingCredentialsProvider(
            context,
            (String) credentialsOptions.get("identity_pool_id"),
            Regions.fromName(cognitoRegion)
          );
        }
        break;
      // TODO: support STS
      default:
        return false;
    }
    // TODO: support ClientConfiguration
    if (credentials != null) {
      s3 = new AmazonS3Client(credentials);
    } else if (credentialsProvider != null) {
      s3 = new AmazonS3Client(credentialsProvider);
    }
    s3.setRegion(region);
    transferUtility = new TransferUtility(s3, context);
    return true;
  }

  @ReactMethod
  public void initializeRNS3(Boolean subscribeProgress) {
    if (alreadyInitialize) return;
    alreadyInitialize = true;
    this.subscribeProgress = subscribeProgress;
    subscribeList(transferUtility.getTransfersWithType(TransferType.UPLOAD));
    subscribeList(transferUtility.getTransfersWithType(TransferType.DOWNLOAD));
  }

  @ReactMethod
  public void setupWithNative(Promise promise) {
    promise.resolve(setup(nativeCredentialsOptions));
  }

  @ReactMethod
  public void setupWithBasic(ReadableMap options, Promise promise) {
    Map<String, Object> credentialsOptions = new HashMap<String, Object>();
    credentialsOptions.put("type", CredentialType.BASIC);
    credentialsOptions.put("access_key", options.getString("access_key"));
    credentialsOptions.put("secret_key", options.getString("secret_key"));
    String sessionToken = options.getString("session_token");
    if (sessionToken != null) {
      credentialsOptions.put("session_token", sessionToken);
    }
    credentialsOptions.put("region", options.getString("region"));
    promise.resolve(setup(credentialsOptions));
  }

  @ReactMethod
  public void setupWithCognito(ReadableMap options, Promise promise) {
    Map<String, Object> credentialsOptions = new HashMap<String, Object>();
    credentialsOptions.put("type", CredentialType.COGNITO);
    credentialsOptions.put("identity_pool_id", options.getString("identity_pool_id"));
    credentialsOptions.put("region", options.getString("region"));
    credentialsOptions.put("cognito_region", options.getString("cognito_region"));
    credentialsOptions.put("caching", options.getBoolean("caching"));
    promise.resolve(setup(credentialsOptions));
  }

  @ReactMethod
  public void upload(ReadableMap options, Promise promise) {
    String bucket = options.getString("bucket");
    String key = options.getString("key");
    File file = new File(options.getString("file"));
    ReadableMap meta = options.getMap("meta");
    ObjectMetadata metaData = new ObjectMetadata();

    TransferObserver task;
    if (meta != null) {
      try {
        String contentType = meta.getString("contentType");
        metaData.setContentType(contentType);
      } catch (Exception e) {}
      try {
        String contentMD5 = meta.getString("contentMD5");
        metaData.setContentMD5(contentMD5);
      } catch (Exception e) {}
      // TODO: more field

      task = transferUtility.upload(bucket, key, file, metaData);
    } else {
      task = transferUtility.upload(bucket, key, file);
    }
    subscribe(task);
    promise.resolve(convertTransferObserver(task));
  }

  @ReactMethod
  public void download(ReadableMap options, Promise promise) {
    String bucket = options.getString("bucket");
    String key = options.getString("key");
    File file = new File(options.getString("file"));
    TransferObserver task = transferUtility.download(bucket, key, file);
    subscribe(task);
    promise.resolve(convertTransferObserver(task));
  }

  @ReactMethod
  public void pause(int id) {
    transferUtility.pause(id);
  }

  @ReactMethod
  public void resume(int id) {
    transferUtility.resume(id);
  }

  @ReactMethod
  public void cancel(int id) {
    transferUtility.cancel(id);
  }

  @ReactMethod
  public void deleteRecord(int id, Promise promise) {
    promise.resolve(transferUtility.deleteTransferRecord(id));
  }

  @ReactMethod
  public void getTask(int id, Promise promise) {
    TransferObserver task = transferUtility.getTransferById(id);
    promise.resolve(convertTransferObserver(task));
  }

  @ReactMethod
  public void getTasks(String type, Promise promise) {
    List<TransferObserver> list = transferUtility.getTransfersWithType(TransferType.getType(type));
    promise.resolve(convertTransferObserverList(list));
  }
}
