/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

/** Specifies type of badge, if any, that should be overlaid on UI component.
 * @beta
 */
export enum BadgeType {
  /** No badge. */
  None = 0,
  /** Standard Technical Preview badge. */
  TechnicalPreview = 1,
  /** Standard New Feature badge. */
  New = 2,
}
