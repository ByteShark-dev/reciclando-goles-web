import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

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

interface ListAllProjectsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAllProjectsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAllProjectsData, undefined>;
  operationName: string;
}
export const listAllProjectsRef: ListAllProjectsRef;

export function listAllProjects(options?: ExecuteQueryOptions): QueryPromise<ListAllProjectsData, undefined>;
export function listAllProjects(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListAllProjectsData, undefined>;

interface GetProjectByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProjectByIdVariables): QueryRef<GetProjectByIdData, GetProjectByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetProjectByIdVariables): QueryRef<GetProjectByIdData, GetProjectByIdVariables>;
  operationName: string;
}
export const getProjectByIdRef: GetProjectByIdRef;

export function getProjectById(vars: GetProjectByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetProjectByIdData, GetProjectByIdVariables>;
export function getProjectById(dc: DataConnect, vars: GetProjectByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetProjectByIdData, GetProjectByIdVariables>;

interface CreateDonationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDonationVariables): MutationRef<CreateDonationData, CreateDonationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateDonationVariables): MutationRef<CreateDonationData, CreateDonationVariables>;
  operationName: string;
}
export const createDonationRef: CreateDonationRef;

export function createDonation(vars: CreateDonationVariables): MutationPromise<CreateDonationData, CreateDonationVariables>;
export function createDonation(dc: DataConnect, vars: CreateDonationVariables): MutationPromise<CreateDonationData, CreateDonationVariables>;

interface UpdateUserBioRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserBioVariables): MutationRef<UpdateUserBioData, UpdateUserBioVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserBioVariables): MutationRef<UpdateUserBioData, UpdateUserBioVariables>;
  operationName: string;
}
export const updateUserBioRef: UpdateUserBioRef;

export function updateUserBio(vars: UpdateUserBioVariables): MutationPromise<UpdateUserBioData, UpdateUserBioVariables>;
export function updateUserBio(dc: DataConnect, vars: UpdateUserBioVariables): MutationPromise<UpdateUserBioData, UpdateUserBioVariables>;

