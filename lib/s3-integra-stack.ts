import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSource from "aws-cdk-lib/aws-lambda-event-sources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

// It sets up the infrastructure for serving assets from an S3 bucket through an API Gateway endpoint.
export class S3IntegraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const bucket = this.createBucketForAssets();
    const apigateway = this.createAPIGateway();
    const executeRole = this.createExecutionRole(bucket);
    bucket.grantReadWrite(executeRole);
    const s3Integration = this.createS3Integration(bucket, executeRole);
    this.addAssetsEndpoint(apigateway, s3Integration);

    // Role for AWS Lambda
    const role = new iam.Role(this, "cdk-rekn-lambdarole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    
    // Policy statement is required to access Rekognition and CloudWatch Logs
    role.addToPolicy(
        new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "rekognition:DetectLabels",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
            ],
            resources: ["*"],
        })
    );

    // DynamoDB table for storing image labels
    const table = new dynamodb.Table(this, "cdk-rekn-imagetable", {
        partitionKey: { name: "Image", type: dynamodb.AttributeType.STRING },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new cdk.CfnOutput(this, "Table", { value: table.tableName });
    new cdk.CfnOutput(this, "Bucket", { value: bucket.bucketName });

    // AWS Lambda function
    const lambdaFn = new lambda.Function(this, "cdk-rekn-function", {
        code: lambda.AssetCode.fromAsset("lambda"),
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: "index.handler",
        role: role,
        environment: {
            TABLE: table.tableName,
            BUCKET: bucket.bucketName,
        },
    });
    
    // Notification of new images in the S3 bucket
    lambdaFn.addEventSource(
        new lambdaEventSource.S3EventSource(bucket, {
            events: [s3.EventType.OBJECT_CREATED],
        })
    );

    // Permissions are granted to the Lambda function to access the S3 bucket and DynamoDB table
    bucket.grantReadWrite(lambdaFn);
    table.grantFullAccess(lambdaFn);

  }
  // Create S3 bucket for assets
  private createBucketForAssets() {
    return new s3.Bucket(this, "upload-to-bucket", {});
  }
  
  // Create API Gateway
  private createAPIGateway() {
    return new apigateway.RestApi(this, "assets-api", {
      restApiName: "S3_bucket_upload_api",
      description: "Serves assets from the S3 bucket.",
      binaryMediaTypes: ["image/jpeg"],
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });
  }
  // Create execution role for S3 integration
  private createExecutionRole(bucket: s3.IBucket) {
    const executeRole = new iam.Role(this, "api-gateway-s3-integration-role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    executeRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [bucket.bucketArn],
        actions: ["s3:PutObject"],
      })
    );

    return executeRole;
  }
  // create S3 integration method, specifying the S3 bucket and execution role
  private createS3Integration(bucket: s3.IBucket, executeRole: iam.Role) {
    return new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "PUT",
      path: `${bucket.bucketName}/{key}`,
      options: {
        credentialsRole: executeRole,
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Content-Type": "integration.response.header.Content-Type",
              "method.response.header.Access-Control-Allow-Origin": "'*'"
            },
          },
        ],
        requestParameters: {
          "integration.request.path.key": "method.request.path.key",
        },
      },
    });
  }
  // Change API endpoint parameters
  private addAssetsEndpoint(
    apigateway: apigateway.RestApi,
    s3Integration: apigateway.AwsIntegration
  ) {
    apigateway.root
      .addResource("{bucket}")
      .addResource("{key}")
      .addMethod("PUT", s3Integration, {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Content-Type": true,
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
        ],
        requestParameters: {
          "method.request.path.key": true,
        },
      });
  }
}
