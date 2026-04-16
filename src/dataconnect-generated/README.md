# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListAllProjects*](#listallprojects)
  - [*GetProjectById*](#getprojectbyid)
- [**Mutations**](#mutations)
  - [*CreateDonation*](#createdonation)
  - [*UpdateUserBio*](#updateuserbio)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListAllProjects
You can execute the `ListAllProjects` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAllProjects(options?: ExecuteQueryOptions): QueryPromise<ListAllProjectsData, undefined>;

interface ListAllProjectsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAllProjectsData, undefined>;
}
export const listAllProjectsRef: ListAllProjectsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAllProjects(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListAllProjectsData, undefined>;

interface ListAllProjectsRef {
  ...
  (dc: DataConnect): QueryRef<ListAllProjectsData, undefined>;
}
export const listAllProjectsRef: ListAllProjectsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAllProjectsRef:
```typescript
const name = listAllProjectsRef.operationName;
console.log(name);
```

### Variables
The `ListAllProjects` query has no variables.
### Return Type
Recall that executing the `ListAllProjects` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAllProjectsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAllProjectsData {
  projects: ({
    id: UUIDString;
    name: string;
    description: string;
    goalAmount: number;
    currentAmount: number;
    startDate: DateString;
    endDate: DateString;
    status?: string | null;
    imageUrl?: string | null;
    organizer?: {
      id: UUIDString;
      displayName: string;
      email: string;
    } & User_Key;
  } & Project_Key)[];
}
```
### Using `ListAllProjects`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAllProjects } from '@dataconnect/generated';


// Call the `listAllProjects()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAllProjects();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAllProjects(dataConnect);

console.log(data.projects);

// Or, you can use the `Promise` API.
listAllProjects().then((response) => {
  const data = response.data;
  console.log(data.projects);
});
```

### Using `ListAllProjects`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAllProjectsRef } from '@dataconnect/generated';


// Call the `listAllProjectsRef()` function to get a reference to the query.
const ref = listAllProjectsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAllProjectsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.projects);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.projects);
});
```

## GetProjectById
You can execute the `GetProjectById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getProjectById(vars: GetProjectByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetProjectByIdData, GetProjectByIdVariables>;

interface GetProjectByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProjectByIdVariables): QueryRef<GetProjectByIdData, GetProjectByIdVariables>;
}
export const getProjectByIdRef: GetProjectByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getProjectById(dc: DataConnect, vars: GetProjectByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetProjectByIdData, GetProjectByIdVariables>;

interface GetProjectByIdRef {
  ...
  (dc: DataConnect, vars: GetProjectByIdVariables): QueryRef<GetProjectByIdData, GetProjectByIdVariables>;
}
export const getProjectByIdRef: GetProjectByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getProjectByIdRef:
```typescript
const name = getProjectByIdRef.operationName;
console.log(name);
```

### Variables
The `GetProjectById` query requires an argument of type `GetProjectByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetProjectByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetProjectById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetProjectByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetProjectByIdData {
  project?: {
    id: UUIDString;
    name: string;
    description: string;
    goalAmount: number;
    currentAmount: number;
    startDate: DateString;
    endDate: DateString;
    status?: string | null;
    imageUrl?: string | null;
    organizer?: {
      id: UUIDString;
      displayName: string;
      email: string;
      photoUrl?: string | null;
    } & User_Key;
      donations_on_project: ({
        id: UUIDString;
        amount: number;
        donatedAt: TimestampString;
        isAnonymous?: boolean | null;
        donor?: {
          id: UUIDString;
          displayName: string;
        } & User_Key;
      } & Donation_Key)[];
        teamMembers_on_project: ({
          id: UUIDString;
          name: string;
          role: string;
          bio?: string | null;
          photoUrl?: string | null;
          socialLink?: string | null;
        } & TeamMember_Key)[];
  } & Project_Key;
}
```
### Using `GetProjectById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getProjectById, GetProjectByIdVariables } from '@dataconnect/generated';

// The `GetProjectById` query requires an argument of type `GetProjectByIdVariables`:
const getProjectByIdVars: GetProjectByIdVariables = {
  id: ..., 
};

// Call the `getProjectById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getProjectById(getProjectByIdVars);
// Variables can be defined inline as well.
const { data } = await getProjectById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getProjectById(dataConnect, getProjectByIdVars);

console.log(data.project);

// Or, you can use the `Promise` API.
getProjectById(getProjectByIdVars).then((response) => {
  const data = response.data;
  console.log(data.project);
});
```

### Using `GetProjectById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getProjectByIdRef, GetProjectByIdVariables } from '@dataconnect/generated';

// The `GetProjectById` query requires an argument of type `GetProjectByIdVariables`:
const getProjectByIdVars: GetProjectByIdVariables = {
  id: ..., 
};

// Call the `getProjectByIdRef()` function to get a reference to the query.
const ref = getProjectByIdRef(getProjectByIdVars);
// Variables can be defined inline as well.
const ref = getProjectByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getProjectByIdRef(dataConnect, getProjectByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.project);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.project);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateDonation
You can execute the `CreateDonation` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createDonation(vars: CreateDonationVariables): MutationPromise<CreateDonationData, CreateDonationVariables>;

interface CreateDonationRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDonationVariables): MutationRef<CreateDonationData, CreateDonationVariables>;
}
export const createDonationRef: CreateDonationRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createDonation(dc: DataConnect, vars: CreateDonationVariables): MutationPromise<CreateDonationData, CreateDonationVariables>;

interface CreateDonationRef {
  ...
  (dc: DataConnect, vars: CreateDonationVariables): MutationRef<CreateDonationData, CreateDonationVariables>;
}
export const createDonationRef: CreateDonationRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createDonationRef:
```typescript
const name = createDonationRef.operationName;
console.log(name);
```

### Variables
The `CreateDonation` mutation requires an argument of type `CreateDonationVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateDonationVariables {
  projectId: UUIDString;
  amount: number;
  isAnonymous?: boolean | null;
}
```
### Return Type
Recall that executing the `CreateDonation` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateDonationData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateDonationData {
  donation_insert: Donation_Key;
}
```
### Using `CreateDonation`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createDonation, CreateDonationVariables } from '@dataconnect/generated';

// The `CreateDonation` mutation requires an argument of type `CreateDonationVariables`:
const createDonationVars: CreateDonationVariables = {
  projectId: ..., 
  amount: ..., 
  isAnonymous: ..., // optional
};

// Call the `createDonation()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createDonation(createDonationVars);
// Variables can be defined inline as well.
const { data } = await createDonation({ projectId: ..., amount: ..., isAnonymous: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createDonation(dataConnect, createDonationVars);

console.log(data.donation_insert);

// Or, you can use the `Promise` API.
createDonation(createDonationVars).then((response) => {
  const data = response.data;
  console.log(data.donation_insert);
});
```

### Using `CreateDonation`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createDonationRef, CreateDonationVariables } from '@dataconnect/generated';

// The `CreateDonation` mutation requires an argument of type `CreateDonationVariables`:
const createDonationVars: CreateDonationVariables = {
  projectId: ..., 
  amount: ..., 
  isAnonymous: ..., // optional
};

// Call the `createDonationRef()` function to get a reference to the mutation.
const ref = createDonationRef(createDonationVars);
// Variables can be defined inline as well.
const ref = createDonationRef({ projectId: ..., amount: ..., isAnonymous: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createDonationRef(dataConnect, createDonationVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.donation_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.donation_insert);
});
```

## UpdateUserBio
You can execute the `UpdateUserBio` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUserBio(vars: UpdateUserBioVariables): MutationPromise<UpdateUserBioData, UpdateUserBioVariables>;

interface UpdateUserBioRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserBioVariables): MutationRef<UpdateUserBioData, UpdateUserBioVariables>;
}
export const updateUserBioRef: UpdateUserBioRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUserBio(dc: DataConnect, vars: UpdateUserBioVariables): MutationPromise<UpdateUserBioData, UpdateUserBioVariables>;

interface UpdateUserBioRef {
  ...
  (dc: DataConnect, vars: UpdateUserBioVariables): MutationRef<UpdateUserBioData, UpdateUserBioVariables>;
}
export const updateUserBioRef: UpdateUserBioRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserBioRef:
```typescript
const name = updateUserBioRef.operationName;
console.log(name);
```

### Variables
The `UpdateUserBio` mutation requires an argument of type `UpdateUserBioVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserBioVariables {
  bio: string;
}
```
### Return Type
Recall that executing the `UpdateUserBio` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserBioData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserBioData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUserBio`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUserBio, UpdateUserBioVariables } from '@dataconnect/generated';

// The `UpdateUserBio` mutation requires an argument of type `UpdateUserBioVariables`:
const updateUserBioVars: UpdateUserBioVariables = {
  bio: ..., 
};

// Call the `updateUserBio()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUserBio(updateUserBioVars);
// Variables can be defined inline as well.
const { data } = await updateUserBio({ bio: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUserBio(dataConnect, updateUserBioVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUserBio(updateUserBioVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUserBio`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserBioRef, UpdateUserBioVariables } from '@dataconnect/generated';

// The `UpdateUserBio` mutation requires an argument of type `UpdateUserBioVariables`:
const updateUserBioVars: UpdateUserBioVariables = {
  bio: ..., 
};

// Call the `updateUserBioRef()` function to get a reference to the mutation.
const ref = updateUserBioRef(updateUserBioVars);
// Variables can be defined inline as well.
const ref = updateUserBioRef({ bio: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserBioRef(dataConnect, updateUserBioVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

