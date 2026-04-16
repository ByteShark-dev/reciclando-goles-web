import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface CreateDonationData {
  donation_insert: Donation_Key;
}

export interface CreateDonationVariables {
  projectId: UUIDString;
  amount: number;
  isAnonymous?: boolean | null;
}

export interface Donation_Key {
  id: UUIDString;
  __typename?: 'Donation_Key';
}

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

export interface GetProjectByIdVariables {
  id: UUIDString;
}

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

export interface Project_Key {
  id: UUIDString;
  __typename?: 'Project_Key';
}

export interface TeamMember_Key {
  id: UUIDString;
  __typename?: 'TeamMember_Key';
}

export interface UpdateUserBioData {
  user_update?: User_Key | null;
}

export interface UpdateUserBioVariables {
  bio: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListAllProjects' Query. Allow users to execute without passing in DataConnect. */
export function listAllProjects(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllProjectsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllProjects' Query. Allow users to pass in custom DataConnect instances. */
export function listAllProjects(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllProjectsData>>;

/** Generated Node Admin SDK operation action function for the 'GetProjectById' Query. Allow users to execute without passing in DataConnect. */
export function getProjectById(dc: DataConnect, vars: GetProjectByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetProjectById' Query. Allow users to pass in custom DataConnect instances. */
export function getProjectById(vars: GetProjectByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectByIdData>>;

/** Generated Node Admin SDK operation action function for the 'CreateDonation' Mutation. Allow users to execute without passing in DataConnect. */
export function createDonation(dc: DataConnect, vars: CreateDonationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDonationData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDonation' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDonation(vars: CreateDonationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDonationData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUserBio' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserBio(dc: DataConnect, vars: UpdateUserBioVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserBioData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserBio' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserBio(vars: UpdateUserBioVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserBioData>>;

