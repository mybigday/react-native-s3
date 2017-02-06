// import RCTBridgeModule.h
#if __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#import "RCTEventDispatcher.h"
#else
#import <React/RCTBridgeModule.h>
#import <React/RCTEventDispatcher.h>
#endif

#import <AWSCore/AWSCore.h>
#import <AWSS3/AWSS3.h>

typedef NS_ENUM(NSInteger, CredentialType) {
    BASIC,
    COGNITO
};

@interface RNS3TransferUtility : NSObject <RCTBridgeModule>
+ (NSMutableDictionary*)nativeCredentialsOptions;
+ (CredentialType)credentialType: (NSString *)type;
+ (void)interceptApplication: (UIApplication *)application handleEventsForBackgroundURLSession:(NSString *)identifier completionHandler:(void (^)())completionHandler;
@end
