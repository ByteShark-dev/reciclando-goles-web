# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { listAllProjects, getProjectById, createDonation, updateUserBio } from '@dataconnect/generated';


// Operation ListAllProjects: 
const { data } = await ListAllProjects(dataConnect);

// Operation GetProjectById:  For variables, look at type GetProjectByIdVars in ../index.d.ts
const { data } = await GetProjectById(dataConnect, getProjectByIdVars);

// Operation CreateDonation:  For variables, look at type CreateDonationVars in ../index.d.ts
const { data } = await CreateDonation(dataConnect, createDonationVars);

// Operation UpdateUserBio:  For variables, look at type UpdateUserBioVars in ../index.d.ts
const { data } = await UpdateUserBio(dataConnect, updateUserBioVars);


```