/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { BackstageSeparator as NZ_BackstageSeparator } from "@bentley/ui-ninezone";
import { BackstageItemProps } from "./BackstageItemProps";

/** Separator Backstage item.
 * @public
 */
export class SeparatorBackstageItem extends React.PureComponent<BackstageItemProps> {
  private static _sSeparatorBackstageItemKey: number;
  private _key: number;

  constructor(separatorBackstageItemDef: BackstageItemProps) {
    super(separatorBackstageItemDef);

    SeparatorBackstageItem._sSeparatorBackstageItemKey++;
    this._key = SeparatorBackstageItem._sSeparatorBackstageItemKey;
  }

  public render(): React.ReactNode {
    return (
      <NZ_BackstageSeparator key={this._key} />
    );
  }
}
