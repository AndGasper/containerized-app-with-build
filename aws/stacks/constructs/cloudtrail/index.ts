import { Construct, Aws } from '@aws-cdk/core';
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose';
import { Role, RoleProps, ServicePrincipal, Policy, PolicyProps } from '@aws-cdk/aws-iam';
import { LogGroup, SubscriptionFilter, FilterPattern, SubscriptionFilterOptions } from '@aws-cdk/aws-logs';
import { Trail } from '@aws-cdk/aws-cloudtrail';
import { Bucket, BlockPublicAccess } from '@aws-cdk/aws-s3';
import { Key, IKey } from '@aws-cdk/aws-kms';
import { PolicyDocument, PolicyStatement, AccountPrincipal, ArnPrincipal } from '@aws-cdk/aws-iam';

export interface CloudTrailProps {
    logBucketName: string;
    trailName: string;
    trailKmsName: string;
    kmsAdminUserArn: string;
}

export interface LogsProps {
    logBucketName: string;
}

export class KinesisStreamLogGroup extends Construct {
    constructor(parent: Construct, name: string, props: LogsProps) {
        super(parent, name); 
        const {
            logBucketName
        } = props;
        const logBucket = this.createLogBucket(logBucketName);
        const kinesisFireHoseRole = this.createKinesisFireHoseRole(); 
        // inherent danger in creating a policy 
        const logDeliveryToS3Policy = this.createLogDeliveryToS3Policy(logBucket);
        // attach the log delivery policy to the kinesisFireHoseRole
        logDeliveryToS3Policy.attachToRole(kinesisFireHoseRole)
        const deliveryStream = this.createDeliveryStream(logBucket["bucketArn"], kinesisFireHoseRole.roleArn);
        const logGroup = this.createLogGroup(logBucketName, logBucket);
        const logGroupSubsscriptionFilter = new SubscriptionFilter(this, 'subscription-filter', {});
        logGroup.addSubscriptionFilter('log-group-stream-filter', logGroupSubsscriptionFilter);

    }
    /**
     * @name createLogGroup
     * @param { String } logBucketName - Use the log bucket's name for the log group name (meh)
     * @param { Bucket } logBucket, - the bucket to send the logs to
     * @description - Crate the log group 
     */
    private createLogGroup(logBucketName: string, logBucket: Bucket) {
        // implicit formatting assumption;
        // use the (then) default retention policy of 2 years
        const logGroup = new LogGroup(this, `log-group-${logBucketName}`, {});
        return logGroup;
    }
    /**
     * @name createS3TrailBucket
     * @param {String} logBucketName
     * @description - Create the s3 bucket used for storing the cloudtrail logs
     * @return {Bucket} logBucket - Bucket for logs 
     */
    private createLogBucket(logBucketName: string) {
        const logBucket = new Bucket(this, logBucketName, {
            blockPublicAccess: new BlockPublicAccess({
                blockPublicAcls: true,
                blockPublicPolicy: true,
                ignorePublicAcls: true,
                restrictPublicBuckets: true
            }), 
            versioned: true
        });
        return logBucket;
    }
    /**
     * @name createLogDeliveryToS3Policy
     * @param {Bucket} logBucket - S3 Log Bucket
     * @description - Create the log delivery policy
     * @return {Policy} - firehose_delivery_policy
     */
    private createLogDeliveryToS3Policy(logBucket: Bucket) {
        const logDeliveryToS3Staement = new PolicyStatement({
            actions: [
                "s3:AbortMultipartUpload",
                "s3:GetBucketLocation",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:ListBucketMultipartUploads",
                "s3:PutObject"
            ],
            resources: [
                logBucket.bucketArn,
                logBucket.arnForObjects("firehose/")
            ]  
        });
        // abstract out to logObjectPrefix?
        // // tighten up principals
        const logDeliveryToS3PolicyProps: PolicyProps = {
            policyName: 'firehose_delivery_policy',
            statements: [ logDeliveryToS3Staement ],
        };
        const logDeliveryToS3Policy = new Policy(this, 'firehose_delivery_policy', logDeliveryToS3PolicyProps);
        return logDeliveryToS3Policy
    }
    /**
     * @name createKinesisFireHoseRole
     * @return kinesisFireHoseRole - AssumeRole for kinesis firehose
     */
    private createKinesisFireHoseRole() {
        const kinesisFireHoseRoleProps: RoleProps = {
            assumedBy: new ServicePrincipal("firehose.amazonaws.com", {
                conditions: {
                    "StringEquals": [
                        {
                            "sts:ExternalId": Aws.ACCOUNT_ID
                        }
                    ]
                }
            })
        };
        // PolicyDocument
        const kinesisFireHoseRole = new Role(this, 'kinesis-firehose-service-role', kinesisFireHoseRoleProps);
        return kinesisFireHoseRole;
    }
    /**
     * @name createDeliveryStream
     * @description - Create the delivery stream
     * @param logBucketArn {string}
     * @param kinesisFireHoseRole {Role["roleArn"]}
     * @return {CfnDeliveryStream} - DeliveryStream for log messages
     */
   private createDeliveryStream(logBucketArn: Bucket["bucketArn"], kinesisFireHoseRoleArn: Role["roleArn"]) {
       const deliveryStreamProps = {
           deliveryStreamName: 'kinesis-delivery-stream',
           extendedS3DestinationConfiguration: {
               bucketArn: logBucketArn,
               bufferingHints: {
                   intervalInSeconds: 60,
                   sizeInMBs: 50,
               },
               compressionFormat: "UNCOMPRESSED",
               prefix: "firehose/",
               roleArn: kinesisFireHoseRoleArn,
               processingConfiguration: {
                   enabled: true
               }
           }
       };
       const deliveryStream = new CfnDeliveryStream(this, 'log-group', deliveryStreamProps);
       return deliveryStream;;
   } 
}
// if the kinesis stream goes out, the application is borked

export class CloudTrail extends Construct {
    constructor(parent: Construct, name: string, props: CloudTrailProps) {
        super(parent, name);
        const {
            trailName,
            trailKmsName,
            kmsAdminUserArn
        } = props;
        
        const kmsIamPolicy = this.createKmsAdminPolicy(kmsAdminUserArn);
        const trailKms = this.createTrailKms(trailKmsName, kmsIamPolicy);
        const trail = this.createCloudTrail(trailName, trailKms);
        trail.onCloudTrailEvent('log-to-kinesis', {
            description: "Log to Kinesis then S3",
        });
        const logGroup = new LogGroup(this, 'log-group-name', {

        })
    }

    /**
     * @name createCloudTrail
     * @param {String} trailName
     * @param {kms.Ikey} kmsKeyInterface 
     * @return {Trail} trail - the cloudtrail for 
     */
    private createCloudTrail(trailName: string, kmsKeyInterface: IKey) {
        // a future iteration of this would probably
        // be able to have log retention configurable 
        const trail = new Trail(this, trailName, {
            // encrypt the logs
            kmsKey: kmsKeyInterface,
        });
        return trail;
    }
    /**
     * @name createKmsAdminPolicy
     * @description - Create an IAM Policy to administer the KMS key
     * @param {String} adminArn - The arn of the key arn
     * @return {PolicyDocument} kmsAdminPolicyDocument 
     */
    private createKmsAdminPolicy(adminArn: string) {
        const kmsAdminPolicyDocument = new PolicyDocument();
        // more sophisticated permission might be advised
        // intentionally set the policy statement principal
        // because I think it tries to default to either the root account
        // or the 
        const kmsAdminPolicyStatement = new PolicyStatement({
            principals: [ 
                new ArnPrincipal(adminArn) 
            ],
            actions: [
                'kms:Create*', 
                'kms:Describe*', 
                'kms:Enable*', 
                'kms:List*', 
                'kms:Put*',
                'kms:Update*', 
                'kms:Revoke*', 
                'kms:Disable*', 
                'kms:Get*', 
                'kms:Delete*',
                'kms:ScheduleKeyDeletion', 
                'kms:CancelKeyDeletion'
            ],
            resources: [
                `arn:aws:kms:${Aws.REGION}:${Aws.ACCOUNT_ID}:key/*`
            ]
        }); 
        kmsAdminPolicyDocument.addStatements(kmsAdminPolicyStatement);
        return kmsAdminPolicyDocument;
    }
    /**
     * @name createTrailKms
     * @param {String} kmsKeyName
     * @param {PolicyDocument} trailKmsPolicy - IAM Policy for KMS
     * @return {kms} kmsKey 
     * @description - Create the KMS key for the trail logs
     */
    private createTrailKms(kmsKeyName: string, trailKmsPolicy: PolicyDocument) {
        const kmsKey = new Key(this, kmsKeyName, {
            description: "The key for the cloudtrail logs",
            enableKeyRotation: true,
            enabled: true,
            policy: trailKmsPolicy
        });
        return kmsKey;   
    }
}