#!/bin/sh

file="./ios/Frameworks/AWSCore.framework"
if [[ "$SKIP_DOWNLOAD_SDK_IF_EXISTS" == "1" ]] && [ -e "$file" ]; then
  exit
fi

VERSION=$1

echo "Downloading AWS iOS SDK $VERSION..."
cd ios/Frameworks

if ! which curl > /dev/null; then echo "curl command not found."; exit 1; fi;
if ! which unzip > /dev/null; then echo "unzip command not found."; exit 1; fi;

if [ -d ./AWSCore.framework ]; then rm -rf ./AWSCore.framework; fi;
if [ -d ./AWSS3.framework ]; then rm -rf ./AWSS3.framework; fi;
if [ -d ./AWSCognito.framework ]; then rm -rf ./AWSCognito.framework; fi;

curl -sS http://sdk-for-ios.amazonwebservices.com/aws-ios-sdk-$VERSION.zip > temp.zip
unzip -o temp.zip -d temp
mv temp/frameworks/AWSCore.framework ./AWSCore.framework
mv temp/frameworks/AWSS3.framework ./AWSS3.framework
mv temp/frameworks/AWSCognito.framework ./AWSCognito.framework
rm -r temp
rm temp.zip
