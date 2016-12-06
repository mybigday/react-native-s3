#import "RNS3TransferUtility.h"
#import "RNS3STSCredentialsProvider.h"

static NSMutableDictionary *nativeCredentialsOptions;
static bool enabledProgress = YES;

@interface RNS3TransferUtility ()

@property (copy, nonatomic) AWSS3TransferUtilityUploadCompletionHandlerBlock completionUploadHandler;
@property (copy, nonatomic) AWSS3TransferUtilityProgressBlock uploadProgress;

@property (copy, nonatomic) AWSS3TransferUtilityDownloadCompletionHandlerBlock completionDownloadHandler;
@property (copy, nonatomic) AWSS3TransferUtilityProgressBlock downloadProgress;

@property (copy, nonatomic) NSString* transferUtilityKey;

@end

@implementation RNS3TransferUtility

@synthesize bridge = _bridge;

+ (NSMutableDictionary *)nativeCredentialsOptions {
  if (nativeCredentialsOptions) {
    return nativeCredentialsOptions;
  }
  nativeCredentialsOptions = [NSMutableDictionary new];
  // default options
  [nativeCredentialsOptions setObject:@"eu-west-1" forKey:@"region"];
  [nativeCredentialsOptions setObject:@"eu-west-1" forKey:@"cognito_region"];
  return nativeCredentialsOptions;
};

+ (CredentialType)credentialType: (NSString *)type {
  if ([type isEqualToString:@"COGNITO"]) {
    return COGNITO;
  } else {
    return BASIC;
  }
}

+ (void)interceptApplication: (UIApplication *)application handleEventsForBackgroundURLSession:(NSString *)identifier completionHandler:(void (^)())completionHandler {
  [AWSS3TransferUtility interceptApplication:application
         handleEventsForBackgroundURLSession:identifier
                           completionHandler:completionHandler];
}

- (AWSRegionType)regionTypeFromString: (NSString*)region {
  AWSRegionType regionType = AWSRegionUnknown;
  if ([region isEqualToString:@"us-east-1"]) {
    regionType = AWSRegionUSEast1;
  } else if ([region isEqualToString:@"us-east-2"]) {
    regionType = AWSRegionUSEast2;
  } else if ([region isEqualToString:@"us-west-1"]) {
    regionType = AWSRegionUSWest1;
  } else if ([region isEqualToString:@"us-west-2"]) {
    regionType = AWSRegionUSWest2;
  } else if ([region isEqualToString:@"eu-west-1"]) {
    regionType = AWSRegionEUWest1;
  } else if ([region isEqualToString:@"eu-central-1"]) {
    regionType = AWSRegionEUCentral1;
  } else if ([region isEqualToString:@"ap-southeast-1"]) {
    regionType = AWSRegionAPSoutheast1;
  } else if ([region isEqualToString:@"ap-southeast-2"]) {
    regionType = AWSRegionAPSoutheast2;
  } else if ([region isEqualToString:@"ap-northeast-1"]) {
    regionType = AWSRegionAPNortheast1;
  } else if ([region isEqualToString:@"sa-east-1"]) {
    regionType = AWSRegionSAEast1;
  } else if ([region isEqualToString:@"cn-north-1"]) {
    regionType = AWSRegionCNNorth1;
  }
  return regionType;
}

- (BOOL)setup:(NSDictionary *)options {
    CredentialType type = [options[@"type"] integerValue];
    id<AWSCredentialsProvider> credentialsProvider;
    
    switch (type) {
        case BASIC: {
            NSString *accessKey = options[@"access_key"];
            NSString *secretKey = options[@"secret_key"];
            NSString *sessionKey = options[@"session_token"];
            
            if (sessionKey) {
                credentialsProvider = [[RNS3STSCredentialsProvider alloc] initWithAccessKey:accessKey
                                                                              secretKey:secretKey
                                                                             sessionKey:sessionKey];
            } else {
                credentialsProvider = [[AWSStaticCredentialsProvider alloc] initWithAccessKey:accessKey
                                                                                    secretKey:secretKey];
            }
            
            break;
        }
        case COGNITO: {
            AWSRegionType region = [self regionTypeFromString:options[@"cognito_region"]];
            NSString *identityPoolId = options[@"identity_pool_id"];
            
            credentialsProvider = [[AWSCognitoCredentialsProvider alloc] initWithRegionType:region
                                                                             identityPoolId:identityPoolId];
            
            break;
        }
        default:
            return NO;
    }

    _transferUtilityKey = [[NSProcessInfo processInfo] globallyUniqueString];

    AWSRegionType region = [self regionTypeFromString:options[@"region"]];
    AWSServiceConfiguration *configuration = [[AWSServiceConfiguration alloc] initWithRegion:region
                                                                         credentialsProvider:credentialsProvider];

    [AWSS3TransferUtility registerS3TransferUtilityWithConfiguration:configuration
                                                              forKey:_transferUtilityKey];
    return YES;
}

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setupWithNative: (RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@([self setup:nativeCredentialsOptions]));
}

RCT_EXPORT_METHOD(setupWithBasic: (NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSMutableDictionary * mOptions = [options mutableCopy];
  [mOptions setObject:[NSNumber numberWithInt:BASIC] forKey:@"type"];
  resolve(@([self setup:mOptions]));
}

RCT_EXPORT_METHOD(setupWithCognito: (NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSMutableDictionary * mOptions = [options mutableCopy];
  [mOptions setObject:[NSNumber numberWithInt:COGNITO] forKey:@"type"];
  resolve(@([self setup:mOptions]));
}

RCT_EXPORT_METHOD(enableProgressSent: (BOOL)enabled resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  enabledProgress = enabled;
  resolve(@YES);
}

- (void) sendEvent:(AWSS3TransferUtilityTask *)task type:(NSString *)type state:(NSString *)state bytes:(int64_t)bytes totalBytes:(int64_t)totalBytes error:(NSError *)error {
  NSDictionary *errorObj = nil;
  if (error) {
    errorObj = @{
      @"domain":[error domain],
      @"code": @([error code]),
      @"description": [error localizedDescription]
    };
  }
  
  if ([state isEqual: @"in_progress"] && !enabledProgress) {
    return;
  }
  [self.bridge.eventDispatcher
    sendAppEventWithName:@"@_RNS3_Events"
    body:@{
      @"task":@{
        @"id":[NSString stringWithFormat:@"%@-%@", _transferUtilityKey, @([task taskIdentifier])],
        // @"bucket":[task bucket],
        // @"key":[task key],
        @"state":state,
        @"bytes":@(bytes),
        @"totalBytes":@(totalBytes)
      },
      @"type":type,
      @"error":errorObj ? errorObj : [NSNull null]
    }];
}

RCT_EXPORT_METHOD(initializeRNS3) {
  self.uploadProgress = ^(AWSS3TransferUtilityTask *task, NSProgress *progress) {
    [self sendEvent:task
               type:@"upload"
              state:@"in_progress"
              bytes:progress.completedUnitCount
         totalBytes:progress.totalUnitCount
              error:nil];
  };
  self.completionUploadHandler = ^(AWSS3TransferUtilityUploadTask *task, NSError *error) {
    NSString *state;
    if (error) state = @"failed"; else state = @"completed";
    [self sendEvent:task
               type:@"upload"
              state:state
              bytes:0
         totalBytes:0
              error:error];
  };
  
  self.downloadProgress = ^(AWSS3TransferUtilityTask *task, NSProgress *progress) {
    [self sendEvent:task
               type:@"download"
              state:@"in_progress"
              bytes:progress.completedUnitCount
         totalBytes:progress.totalUnitCount
              error:nil];
  };
  self.completionDownloadHandler = ^(AWSS3TransferUtilityDownloadTask *task, NSURL *location, NSData *data, NSError *error) {
    NSString *state;
    if (error) state = @"failed"; else state = @"completed";
    [self sendEvent:task
               type:@"download"
              state:state
              bytes:0
         totalBytes:0
              error:error];
  };
  
  AWSS3TransferUtility *transferUtility = [AWSS3TransferUtility S3TransferUtilityForKey:_transferUtilityKey];
  [transferUtility
    enumerateToAssignBlocksForUploadTask:^(AWSS3TransferUtilityUploadTask * _Nonnull uploadTask,
      AWSS3TransferUtilityProgressBlock  _Nullable __autoreleasing * _Nullable uploadProgressBlockReference,
      AWSS3TransferUtilityUploadCompletionHandlerBlock  _Nullable __autoreleasing * _Nullable completionHandlerReference
    ) {
      *uploadProgressBlockReference = self.uploadProgress;
      *completionHandlerReference = self.completionUploadHandler;
    }
    downloadTask:^(AWSS3TransferUtilityDownloadTask * _Nonnull downloadTask,
      AWSS3TransferUtilityProgressBlock  _Nullable __autoreleasing * _Nullable downloadProgressBlockReference,
      AWSS3TransferUtilityDownloadCompletionHandlerBlock  _Nullable __autoreleasing * _Nullable completionHandlerReference
    ) {
     
      *downloadProgressBlockReference = self.downloadProgress;
      *completionHandlerReference = self.completionDownloadHandler;
    }];
}

RCT_EXPORT_METHOD(upload: (NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *fileURL = [NSURL fileURLWithPath:[options objectForKey:@"file"]];
  NSDictionary *meta = [options objectForKey:@"meta"];
  
  AWSS3TransferUtilityUploadExpression *expression = [AWSS3TransferUtilityUploadExpression new];
  if (meta) {
    for (id key in meta) {
      NSString *value = [meta objectForKey:key];
      [expression setValue:value forRequestHeader:key];
    }
  }

  expression.progressBlock = self.uploadProgress;

  AWSS3TransferUtility *transferUtility = [AWSS3TransferUtility S3TransferUtilityForKey:_transferUtilityKey];
  [[transferUtility uploadFile:fileURL
                        bucket:[options objectForKey:@"bucket"]
                           key:[options objectForKey:@"key"]
                   contentType:[meta objectForKey:@"Content-Type"]
                    expression:expression
              completionHander:self.completionUploadHandler] continueWithBlock:^id(AWSTask *task) {
    if (task.error) {
      reject([NSString stringWithFormat: @"%lu", (long)task.error.code], task.error.localizedDescription, task.error);
    } else if (task.exception) {
      NSLog(@"Exception: %@", task.exception);
    } else if (task.result) {
      AWSS3TransferUtilityUploadTask *uploadTask = task.result;
      resolve(@{
        @"id": [NSString stringWithFormat:@"%@-%@", _transferUtilityKey, @([uploadTask taskIdentifier])],
        // @"bucket": [uploadTask bucket],
        // @"key": [uploadTask key],
        @"state":@"waiting"
      });
    }
    return nil;
  }];
}

RCT_EXPORT_METHOD(download: (NSDictionary *)options resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *fileURL = [NSURL fileURLWithPath:[options objectForKey:@"file"]];

  AWSS3TransferUtilityDownloadExpression *expression = [AWSS3TransferUtilityDownloadExpression new];
  expression.progressBlock = self.downloadProgress;

  AWSS3TransferUtility *transferUtility = [AWSS3TransferUtility S3TransferUtilityForKey:_transferUtilityKey];
  [[transferUtility downloadToURL:fileURL
                           bucket:[options objectForKey:@"bucket"]
                              key:[options objectForKey:@"key"]
                       expression:expression
                 completionHander:self.completionDownloadHandler] continueWithBlock:^id(AWSTask *task) {
    if (task.error) {
      reject([NSString stringWithFormat: @"%lu", (long)task.error.code], task.error.localizedDescription, task.error);
    } else if (task.exception) {
      NSLog(@"Exception: %@", task.exception);
    } else if (task.result) {
      AWSS3TransferUtilityDownloadTask *downloadTask = task.result;
      resolve(@{
        @"id": [NSString stringWithFormat:@"%@-%@", _transferUtilityKey, @([downloadTask taskIdentifier])],
        //@"bucket":[downloadTask bucket],
        //@"key":[downloadTask key],
        @"state":@"waiting"
      });
    }
    return nil;
  }];
}

RCT_EXPORT_METHOD(pause:(int64_t)taskIdentifier) {
  [self taskById:taskIdentifier completionHandler:^(NSDictionary *result) {
    if (result) {
      NSString *type = [result objectForKey:@"type"];
      AWSS3TransferUtilityTask *task = [result objectForKey:@"task"];
      [task suspend];
      [self sendEvent:task
                 type:type
                state:@"paused"
                bytes:0
           totalBytes:0
                error:nil];
    }
  }];

}

RCT_EXPORT_METHOD(resume:(int64_t)taskIdentifier) {
  [self taskById:taskIdentifier completionHandler:^(NSDictionary *result) {
    if (result) {
      NSString *type = [result objectForKey:@"type"];
      AWSS3TransferUtilityTask *task = [result objectForKey:@"task"];
      [task resume];
      [self sendEvent:task
                 type:type
                state:@"in_progress"
                bytes:0
           totalBytes:0
                error:nil];
    }
  }];
}

RCT_EXPORT_METHOD(cancel:(int64_t)taskIdentifier) {
  [self taskById:taskIdentifier completionHandler:^(NSDictionary *result) {
    if (result) {
      NSString *type = [result objectForKey:@"type"];
      AWSS3TransferUtilityTask *task = [result objectForKey:@"task"];
      [task cancel];
      [self sendEvent:task
                 type:type
                state:@"canceled"
                bytes:0
           totalBytes:0
                error:nil];
    }
  }];
}

- (void) taskById:(int64_t)taskIdentifier completionHandler:(void(^)(NSDictionary *))handler {
  __block NSDictionary *result = [NSNull null];
  AWSS3TransferUtility *transferUtility = [AWSS3TransferUtility S3TransferUtilityForKey:_transferUtilityKey];
  [[[transferUtility getUploadTasks] continueWithBlock:^id(AWSTask *task) {
    if (task.result) {
      NSArray<AWSS3TransferUtilityUploadTask*> *uploadTasks = task.result;
      for (AWSS3TransferUtilityUploadTask *task in uploadTasks) {

        if ([task taskIdentifier] == taskIdentifier) {
          result = @{
            @"type":@"upload",
            @"task":task
          };
          return nil;
        }
      }
    }
    return [transferUtility getDownloadTasks];
  }] continueWithBlock: ^id(AWSTask *task) {
    if (task.result) {
      NSArray<AWSS3TransferUtilityDownloadTask*> *downloadTasks = task.result;
      for (AWSS3TransferUtilityDownloadTask *task in downloadTasks) {
        if ([task taskIdentifier] == taskIdentifier) {
          result = @{
            @"type":@"download",
            @"task":task
          };
          return nil;
        }
      }
    }
    handler(result);
    return nil;
  }];
}

RCT_EXPORT_METHOD(getTask:(int64_t)taskIdentifier resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [self taskById:taskIdentifier completionHandler:^(NSDictionary *result) {
    if (result) {
      AWSS3TransferUtilityTask *task = [result objectForKey:@"task"];
      resolve(@{
        @"id": [NSString stringWithFormat:@"%@-%@", _transferUtilityKey, @([task taskIdentifier])],
        //@"bucket":[task bucket],
        //@"key":[task key],
      });
    } else {
      resolve([NSNull null]);
    }
  }];
}

RCT_EXPORT_METHOD(getTasks:(NSString *)type resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  AWSS3TransferUtility *transferUtility = [AWSS3TransferUtility S3TransferUtilityForKey:_transferUtilityKey];
  NSMutableArray *result = [[NSMutableArray alloc] init];
  if ([type isEqualToString:@"upload"]) {
    [[transferUtility getUploadTasks] continueWithBlock:^id(AWSTask *task) {
      if (task.result) {
        NSArray<AWSS3TransferUtilityUploadTask*> *uploadTasks = task.result;
        for (AWSS3TransferUtilityUploadTask *task in uploadTasks) {
          [result addObject:@{
            @"id": [NSString stringWithFormat:@"%@-%@", _transferUtilityKey, @([task taskIdentifier])],
            // @"bucket":[task bucket],
            // @"key":[task key],
          }];
        }
        resolve(result);
      } else {
        resolve(nil);
      }
      return nil;
    }];
  } else if ([type isEqualToString:@"download"]) {
    [[transferUtility getDownloadTasks] continueWithBlock:^id(AWSTask *task) {
      if (task.result) {
        NSArray<AWSS3TransferUtilityDownloadTask*> *downloadTasks = task.result;
        for (AWSS3TransferUtilityDownloadTask *task in downloadTasks) {
          [result addObject:@{
            @"id": [NSString stringWithFormat:@"%@-%@", _transferUtilityKey, @([task taskIdentifier])],
            // @"bucket":[task bucket],
            // @"key":[task key],
          }];
        }
        resolve(result);
      } else {
        resolve(nil);
      }
      return nil;
    }];
  } else {
    resolve(nil);
  }
}

@end
