""" Lambda function detect labels in image using Amazon Rekognition """
import os
import boto3


def handler(event, context):
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]

    rek_function(bucket, key)


def rek_function(bucket, key):
    print(f"Detected the following image in S3: Bucket: {bucket} key name: {key}")

    client = boto3.client("rekognition")

    response = client.detect_labels(
        Image={"S3Object": {"Bucket": bucket, "Name": key}},
        MaxLabels=10,
        MinConfidence=60,
    )

    # Get the service resource
    dynamodb = boto3.resource("dynamodb")

    # Instantiate a table resource object
    table = dynamodb.Table(os.environ["TABLE"])

    # Put item into table
    table.put_item(Item={"Image": key})

    objects_detected = []

    for label in response["Labels"]:
        new_item = label["Name"]
        objects_detected.append(new_item)
        object_num = len(objects_detected)
        item_attr = f"object{object_num}"
        response = table.update_item(
            Key={"Image": key},
            UpdateExpression=f"set {item_attr} = :r",
            ExpressionAttributeValues={":r": f"{new_item}"},
            ReturnValues="UPDATED_NEW",
        )
