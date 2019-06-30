export const RepositoryEventRules = {
    "createRepository": {
        description: "",
        enabled: true,
        eventPattern: {
            version: '1.0',
            source: []
        }
    }
}

// - rule
//     - description
//     - enabled
//     - eventPattern
//     - ruleName
//     - schedule
//     - targets
// if you specify a name
//  then update
//  results in:
//      - update
//      - some interruption
// must 
// 1-64 characters