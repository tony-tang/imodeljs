/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import classnames from "classnames";

import { Orientation, CommonProps } from "@bentley/ui-core";
import { PropertyRecord, PropertyValueFormat } from "@bentley/imodeljs-frontend";

import { PropertyRenderer } from "../../properties/renderers/PropertyRenderer";
import { ActionButtonRenderer } from "../../properties/renderers/ActionButtonRenderer";
import { PropertyCategory } from "../PropertyDataProvider";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import { PropertyUpdatedArgs } from "../../editors/EditorContainer";

/** Properties of [[PropertyList]] React component
 * @public
 */
export interface PropertyListProps extends CommonProps {
  orientation: Orientation;
  category?: PropertyCategory;
  properties: PropertyRecord[];
  selectedPropertyKey?: string;
  onPropertyClicked?: (property: PropertyRecord, key?: string) => void;
  onPropertyRightClicked?: (property: PropertyRecord, key?: string) => void;
  onPropertyContextMenu?: (property: PropertyRecord, e: React.MouseEvent) => void;
  columnRatio?: number;
  onColumnChanged?: (ratio: number) => void;
  propertyValueRendererManager?: PropertyValueRendererManager;
  editingPropertyKey?: string;
  onEditCommit?: (args: PropertyUpdatedArgs, category: PropertyCategory) => void;
  onEditCancel?: () => void;
  /** Enables/disables property hovering effect */
  isPropertyHoverEnabled?: boolean;
  /** Enables/disables property selection */
  isPropertySelectionEnabled?: boolean;
  /** Enables/disables property right click selection */
  isPropertyRightClickSelectionEnabled?: boolean;
  /** Array of action button renderers */
  actionButtonRenderers?: ActionButtonRenderer[];
}

/**
 * Get unique key for property record
 * @internal
 */
export function getPropertyKey(propertyCategory: PropertyCategory, propertyRecord: PropertyRecord) {
  return propertyCategory.name + propertyRecord.property.name;
}

/** State of [[PropertyList]] React component
 * @internal
 */
interface PropertyListState {
  /** Width of the whole property list container */
  width?: number;
}

/** A React component that renders multiple properties within a category as a list.
 * @public
 */
export class PropertyList extends React.Component<PropertyListProps, PropertyListState> {

  /** @internal */
  public readonly state: PropertyListState = {};

  constructor(props: PropertyListProps) {
    super(props);
  }

  private _listRef = React.createRef<HTMLDivElement>();

  private _onEditCommit = (args: PropertyUpdatedArgs) => {
    if (this.props.onEditCommit && this.props.category)
      this.props.onEditCommit(args, this.props.category);
  }
  private afterRender() {
    if (this.props.orientation !== Orientation.Horizontal || !this._listRef.current)
      return;
    const width = this._listRef.current.getBoundingClientRect().width;
    if (width !== this.state.width)
      this.setState({ width });
  }

  /** @internal */
  public componentDidMount() {
    this.afterRender();
  }

  /** @internal */
  public componentDidUpdate() {
    this.afterRender();
  }

  /** @internal */
  public render() {
    const propertyListClassName = classnames(
      (this.props.orientation === Orientation.Horizontal) ? "components-property-list--horizontal" : "components-property-list--vertical",
      this.props.className,
    );

    return (
      <div className={propertyListClassName} style={this.props.style} ref={this._listRef}>
        {this.props.properties.map((propertyRecord: PropertyRecord) => {
          const key = this.props.category ? getPropertyKey(this.props.category, propertyRecord) : propertyRecord.property.name;
          return (
            <PropertyRenderer
              key={key}
              uniqueKey={key}
              isHoverable={this.props.isPropertyHoverEnabled}
              isSelectable={this.props.isPropertySelectionEnabled}
              isSelected={key === this.props.selectedPropertyKey}
              propertyRecord={propertyRecord}
              orientation={this.props.orientation}
              onClick={propertyRecord.value.valueFormat === PropertyValueFormat.Primitive ? this.props.onPropertyClicked : undefined}
              onRightClick={propertyRecord.value.valueFormat === PropertyValueFormat.Primitive ? this.props.onPropertyRightClicked : undefined}
              onContextMenu={this.props.onPropertyContextMenu}
              columnRatio={this.props.columnRatio}
              onColumnRatioChanged={this.props.onColumnChanged}
              propertyValueRendererManager={this.props.propertyValueRendererManager}
              isEditing={key === this.props.editingPropertyKey}
              onEditCommit={this._onEditCommit}
              onEditCancel={this.props.onEditCancel}
              width={this.state.width}
              actionButtonRenderers={this.props.actionButtonRenderers}
            />);
        })}
      </div>
    );
  }
}
