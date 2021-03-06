/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { StatusBarItemType, StatusBarSection } from "@bentley/ui-abstract";
import { StatusBarItem } from "./StatusBarItem";

/** Utility methods for creating and maintaining StatusBar items.
 * @beta
 */
export class StatusBarItemUtilities {

  /** Creates a StatusBar item */
  public static createStatusBarItem = (id: string, section: StatusBarSection, itemPriority: number, reactNode: React.ReactNode, itemProps?: Partial<StatusBarItem>): StatusBarItem => ({
    id, section, itemPriority, reactNode,
    isVisible: true,
    type: StatusBarItemType.CustomItem,
    ...itemProps ? itemProps : {},
  })

}
