/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/**
 * Specification to define a custom property category.
 * @beta
 */
export interface PropertyCategorySpecification {
  /** Category identifier which has to be unique at the scope of it's definition */
  id: string;

  /** Display label of the category. May be [localized]($docs/learning/presentation/Localization.md). */
  label: string;

  /** Optional extensive description of the category. */
  description?: string;

  /**
   * Priority of the category. Higher priority categories are displayed on top. Defaults to `1000`.
   * @type integer
   */
  priority?: number;

  /** Should this category be auto-expanded. Defaults to `false`. */
  autoExpand?: boolean;
}
