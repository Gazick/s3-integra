# Upload an image to S3 and detect objects in the image

Learn how to build a web app for uploading images to S3 bucket, which then processed automatically.

## AWS Services Used

- S3
- Lambda
- API Gateway
- Rekognition
- DynamoDB

## Schema

<img src="https://github.com/Gazick/s3-integra/blob/main/s3ApiLambdaDyn.jpg" alt="Schema">

## How to start React App

* `nmp install`     install required packages, needed only once
* `cd upload-to-s3` change directory
* `npm start`       start React app


## Deploy stack

* `cd ..`           change to the root directory
* `nmp install`     install required packages, needed only once
* `cdk deploy`      deploy this stack to your default AWS account/region
