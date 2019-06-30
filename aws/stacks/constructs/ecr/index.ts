#!/usr/bin/env node
import { Construct } from '@aws-cdk/core';
import { RepositoryProps, Repository } from '@aws-cdk/aws-ecr';
import { DockerImageAsset, DockerImageAssetProps } from '@aws-cdk/aws-ecr-assets';

// const asset = new DockerImageAsset(this, 'WpImage', {
//     directory: path.join()
// });

export interface DockerEcrAssetProps {
    dockerImageDefinition: DockerImageAssetProps;
    assetId: string;
}


export class EcrAsset extends Construct {
    constructor(parent: Construct, name: string, props: DockerEcrAssetProps) {
        super(parent, name);
        const {
            dockerImageDefinition,
            assetId
        } = props;
        const asset = this.createDockerAsset(assetId, dockerImageDefinition);
    }
    /**
     * @name createDockerAsset
     * @param {DockerImageAssetProps} dockerImageDefinition
     * @return {DockerImageAsset} asset   
     * 
     */
    private createDockerAsset(assetId: string, dockerImageDefinition: DockerImageAssetProps) {
        // const asset = new DockerImageAsset(this, dockerImageDefinition);
        const asset = new DockerImageAsset(this, assetId, dockerImageDefinition);
        return asset;
    }
}

// this is probably 
export interface ContainerImageRepositoryProps {
    id: string;
    repositoryProps: RepositoryProps;


}
export interface RepositoryDefinition {
    repositoryId: string;
    repositoryProps: RepositoryProps;
}
export class ContainerImageRepository extends Construct {
    constructor(parent: Construct, name: string, props: ContainerImageRepositoryProps) {
        super(parent, name);
        const {
            id,
            repositoryProps
        } = props;
        this.createImageRepository(id, repositoryProps);
    }
    protected createImageRepository(repositoryId: string, repositoryProps: RepositoryProps) {
        const repository = new Repository(this, repositoryId, repositoryProps);   
        const cloudTrailRule = repository.onCloudTrailEvent('repo-cloud-trail-event');
        // cloudTrailRule.addTarget(repository.repositoryArn);
        console.log('cloudTrailRule', cloudTrailRule);

    }

}


// import { DockerImageAsset } from '@aws-cdk/assets-docker';

// const asset = new DockerImageAsset(this, 'MyBuildImage', {
//   directory: path.join(__dirname, 'my-image')
// });