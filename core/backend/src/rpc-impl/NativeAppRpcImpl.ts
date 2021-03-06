/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @module RpcInterface */

import {
  IModelTokenProps,
  NativeAppRpcInterface,
  QueuedEvent,
  RpcInterface,
  RpcManager,
} from "@bentley/imodeljs-common";
import { EventSinkManager } from "./EventSink";

/** The backend implementation of NativeAppRpcInterface.
 * @internal
 */
export class NativeAppRpcImpl extends RpcInterface implements NativeAppRpcInterface {
  public static register() {
    RpcManager.registerImpl(NativeAppRpcInterface, NativeAppRpcImpl);
  }

  public async fetchEvents(tokenProps: IModelTokenProps, limit: number): Promise<QueuedEvent[]> {
    let key: string = EventSinkManager.GLOBAL;
    if (tokenProps.key && tokenProps.key !== EventSinkManager.GLOBAL)
      key = tokenProps.key;

    return EventSinkManager.get(key).fetch(limit);
  }
}
