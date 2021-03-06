/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import * as path from 'path';
import { Stack, IConstruct } from '@aws-cdk/core';

export const isCrossAccount = (x: IConstruct, y: IConstruct, includeRegion?: boolean): boolean => {
  const stackX = Stack.of(x);
  const stackY = Stack.of(y);
  const diffAccount = stackX.account !== stackY.account;
  const diffRegion = stackX.region !== stackY.region;
  return includeRegion ? diffAccount && diffRegion : diffAccount;
};

export const isCrossStack = (x: IConstruct, y: IConstruct): boolean => {
  return Stack.of(x) !== Stack.of(y);
};

export const getPackageVersion: () => string = () => {
  const file = fs.readFileSync(path.resolve(__dirname, '../../package.json')).toString();
  return JSON.parse(file).version as string;
};
