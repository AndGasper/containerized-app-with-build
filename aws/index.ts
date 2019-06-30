#!/usr/bin/env node
import { Stack, App, StackProps, Tag } from '@aws-cdk/core';
import { ContainerImageRepository } from './stacks/constructs/ecr/index';
const app = new App();
// const containerImageRepository = new ContainerImageRepository(this);
const exampleStack = new Stack(app, 'ExampleStack');
exampleStack.node.applyAspect(new Tag('name', 'example-stack'));

class ImageRepository extends Stack {
    constructor(parent: App, name: string, props: StackProps) {
        super(parent, name, props);
        const containerImageRepositoryProps = getImageRepoProps();
        new ContainerImageRepository(this,
            'container-image-repo',
            containerImageRepositoryProps
        );
    }
}

function getImageRepoProps() {
    return this.node.tryGetContext('containerImageRepoProps');
}