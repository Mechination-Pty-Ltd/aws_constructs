# aws_constructs

Shared AWS CDK Constructs used by Mechination



## Cloudfront-Website
This is used to publish a cloudfront distribution that hosts a static website, but the S3 bucket is in a region of your chosing. The region of the S3 bucket is important because it influences the latency of fetches when there is a cache-miss from cloudfront.