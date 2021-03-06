/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHubClient */

import { RequestQueryOptions } from "../Request";
import { WsgQuery } from "../WsgQuery";
import { ArgumentCheck } from "./Errors";
import { GuidString } from "@bentley/bentleyjs-core";

/** Query for instances with string based instance ids.
 * @beta
 */
export class StringIdQuery extends WsgQuery {
  /** @internal */
  protected _byId?: string;

  /**
   * Query single instance by its id.
   * @param id Id of the instance to query.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid [GuidString]($bentley) value.
   */
  public byId(id: string) {
    this.checkValue(id);
    this._byId = id;
    this._query.$pageSize = undefined;
    return this;
  }

  /** @internal */
  protected checkValue(id: string) {
    ArgumentCheck.valid("id", id);
  }

  /**
   * Used by iModelHub handlers to get the id that is queried.
   * @internal
   */
  public getId() {
    return this._byId;
  }
}

/** Query for instances with Guid based instance ids.
 * @beta
 */
export class InstanceIdQuery extends WsgQuery {
  /** @internal */
  protected _byId?: GuidString;

  /**
   * Query single instance by its id.
   * @param id Id of the instance to query.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if id is undefined or it is not a valid [GuidString]($bentley) value.
   */
  public byId(id: GuidString) {
    ArgumentCheck.validGuid("id", id);
    this._byId = id;
    this._query.$pageSize = undefined;
    return this;
  }

  /**
   * Used by iModelHub handlers to get the id that is queried.
   * @internal
   */
  public getId() {
    return this._byId;
  }
}

/**
 * Add select for the download URL to the query.
 * @internal
 */
export function addSelectFileAccessKey(query: RequestQueryOptions) {
  if (!query.$select)
    query.$select = "*";

  query.$select += ",FileAccessKey-forward-AccessKey.DownloadURL";
}

/**
 * Add select for the application data to the query.
 * @internal
 */
export function addSelectApplicationData(query: RequestQueryOptions) {
  if (!query.$select)
    query.$select = "*";

  query.$select += ",CreatedByApplication-forward-Application.*";
}
