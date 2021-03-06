/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Plugins */

import { ConditionalDisplayType } from "../items/ConditionalDisplayType";
import { BadgeType } from "../items/BadgeType";

/** Interface used to define a UI item whose display may change based on the current state of the application, such as the active view, the select element(s), etc.
 * @alpha
 */
export interface ConditionalDisplaySpecification {
  type: ConditionalDisplayType;
  testFunc: () => boolean;
  syncEventIds: string[];  // sync ids that will trigger hideShowFunc to be reevaluated when fired
}

/** Describes the data needed to insert a UI items into an existing set of UI items.
 * @alpha
 */
export interface InsertSpec {
  /** Optional parent tool group to add tool. */
  parentToolGroupId?: string;
  condition?: ConditionalDisplaySpecification;
  label: string;
}

/** Used to specify the item type added to toolbar.
 * @alpha
 */
export enum ToolbarItemType {
  /** Used when insert specification defines a button to execute an action. */
  ActionButton = 0,
  /** Used when insert specification defines a group button to that specify list of toolbar items. */
  GroupButton = 1,
}

/** Describes the data needed to insert a button into a toolbar.
 * @alpha
 */
export interface ToolbarItemInsertSpec extends InsertSpec {
  /** Require uniqueId for the item. To ensure uniqueness it is suggested that a namespace prefix of the plugin name be used. */
  itemId: string;
  /** type of item to be inserted */
  itemType: ToolbarItemType;
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  icon: string;
  /** if not specified no badge will be created. */
  badge?: BadgeType;
}

/** Describes the data needed to insert an action button into a toolbar.
 * @alpha
 */
export interface ActionItemInsertSpec extends ToolbarItemInsertSpec {
  readonly itemType: ToolbarItemType.ActionButton;
  execute: () => void;
}

/** Describes the data needed to insert a group button into a toolbar.
 * @alpha
 */
export interface GroupItemInsertSpec extends ToolbarItemInsertSpec {
  readonly itemType: ToolbarItemType.GroupButton;
  items: ToolbarItemInsertSpec[];
}
