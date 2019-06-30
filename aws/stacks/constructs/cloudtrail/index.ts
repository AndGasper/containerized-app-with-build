import { Trail } from '@aws-cdk/aws-cloudtrail';
import { Construct } from '@aws-cdk/core';
import { Bucket, BlockPublicAccess } from '@aws-cdk/aws-s3';
import { Key, IKey } from '@aws-cdk/aws-kms';
import { PolicyDocument, PolicyStatement, AccountPrincipal, ArnPrincipal } from '@aws-cdk/aws-iam';

export interface CloudTrailProps {
    logBucketName: string;
    trailName: string;
    trailKmsName: string;
    kmsAdminUserArn: string;
}

export class CloudTrail extends Construct {
    constructor(parent: Construct, name: string, props: CloudTrailProps) {
        super(parent, name);
        const {
            logBucketName,
            trailName,
            trailKmsName,
            kmsAdminUserArn
        } = props;
        const logBucket = this.createS3TrailBucket(logBucketName);
        const kmsIamPolicy = this.createKmsAdminPolicy(kmsAdminUserArn);
        const trailKms = this.createTrailKms(trailKmsName, kmsIamPolicy);
        const trail = this.createCloudTrail(trailName, trailKms);
    }
    /**
     * @name createS3TrailBucket
     * @param {String} logBucketName
     * @description - Create the s3 bucket used for storing the cloudtrail logs
     * @return {Bucket} logBucket - 
     */
    private createS3TrailBucket(logBucketName: string) {
        const logBucket = new Bucket(this, logBucketName, {
            blockPublicAccess: new BlockPublicAccess({
                blockPublicAcls: true,
                blockPublicPolicy: true,
                ignorePublicAcls: true,
                restrictPublicBuckets: true
            })
        });
        return logBucket;
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
                'arn:aws:kms:{region}:{accountId}:key/*"'
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