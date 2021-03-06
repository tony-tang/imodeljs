/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import { TreeTest } from "./Tree";
import { BeInspireTreeNode } from "./BeInspireTree";
import { TreeNodeItem } from "../TreeDataProvider";
import {
  TreeNode as TreeNodeBase, NodeCheckboxProps as CheckboxProps, Omit,
  CheckBoxState, NodeCheckboxRenderer, shallowDiffers, CommonProps,
} from "@bentley/ui-core";
import { TreeNodeContent } from "./NodeContent";
import { CellEditingEngine } from "../CellEditingEngine";
import { HighlightableTreeNodeProps } from "../HighlightingEngine";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import { ITreeImageLoader } from "../ImageLoader";
import { Image } from "../../common/IImageLoader";
import { ImageRenderer } from "../../common/ImageRenderer";

/**
 * Properties for Checkbox in [[TreeNode]]
 * @public @deprecated Use [[ControlledTree]] instead
 */
export interface NodeCheckboxProps extends Omit<CheckboxProps, "onClick"> {
  onClick: (node: BeInspireTreeNode<TreeNodeItem>, newState: CheckBoxState) => void;
}

/**
 * Properties for [[TreeNode]] React component
 * @public @deprecated Use [[ControlledTree]] instead
 */
export interface TreeNodeProps extends CommonProps {
  node: BeInspireTreeNode<TreeNodeItem>;
  checkboxProps?: NodeCheckboxProps;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;

  /** @beta */
  cellEditing?: CellEditingEngine;
  /** @beta */
  highlightProps?: HighlightableTreeNodeProps;

  showDescription?: boolean;
  valueRendererManager: PropertyValueRendererManager;

  /** If specified, icon from node will be loaded by provided ImageLoader */
  imageLoader?: ITreeImageLoader;

  renderOverrides?: {
    /** @beta */
    renderCheckbox?: NodeCheckboxRenderer;
  };

  /**
   * Called when all of the component tasks are done.
   * There are 3 different conditions:
   * * Props and node did not update so there is no need to render.
   * * Provided label function was synchronous and the render finished.
   * * Provided label function was asynchronous and the second render finished.
   */
  onFinalRenderComplete?: (renderId: string) => void;
  /**
   * Id specified by the parent component to identify all
   * nodes rendered at one request
   */
  renderId?: string;
}

/**
 * Default component for rendering a node for the [Tree]($ui-components)
 * @public @deprecated Use [[ControlledTree]] instead
 */
export class TreeNode extends React.Component<TreeNodeProps> {

  constructor(props: TreeNodeProps) {
    super(props);
  }

  public shouldComponentUpdate(nextProps: TreeNodeProps) {
    if (nextProps.node.isDirty() || doPropsDiffer(this.props, nextProps))
      return true;

    // This is an anti-pattern, but it's main purpose is for testing.
    // We need to know when all of the nodes have finished rendering
    // and asynchronous updates make it very difficult.
    // If it should not render, let the parent know that it's
    // already fully rendered
    if (nextProps.renderId && nextProps.onFinalRenderComplete)
      nextProps.onFinalRenderComplete(nextProps.renderId);

    return false;
  }

  public componentDidUpdate(_prevProps: TreeNodeProps) {
    if (this.props.node.isDirty())
      this.props.node.setDirty(false);
  }

  public render() {
    const checkboxProps: CheckboxProps | undefined = this.props.checkboxProps ? {
      ...this.props.checkboxProps,
      onClick: this._onCheckboxClick,
    } : undefined;

    const label = (
      <TreeNodeContent
        node={this.props.node}
        cellEditing={this.props.cellEditing}
        highlightProps={this.props.highlightProps}
        showDescription={this.props.showDescription}
        valueRendererManager={this.props.valueRendererManager}
        onFinalRenderComplete={this.props.onFinalRenderComplete}
        renderId={this.props.renderId}
      />);

    return (
      <TreeNodeBase
        data-testid={TreeTest.TestId.Node}
        className={this.props.className}
        style={this.props.style}
        isExpanded={this.props.node.expanded()}
        isSelected={this.props.node.selected()}
        isLoading={this.props.node.loading()}
        isLeaf={!this.props.node.hasOrWillHaveChildren()}
        label={label}
        icon={this.props.imageLoader ? <TreeNodeIcon node={this.props.node} imageLoader={this.props.imageLoader} /> : undefined}
        checkboxProps={checkboxProps}
        level={this.props.node.getParents().length}
        renderOverrides={{ renderCheckbox: this.props.renderOverrides ? this.props.renderOverrides.renderCheckbox : undefined }}
        onClick={this.props.onClick}
        onMouseMove={this.props.onMouseMove}
        onMouseDown={this.props.onMouseDown}
        onClickExpansionToggle={() => this.props.node.toggleCollapse()}
      />
    );
  }

  private _onCheckboxClick = (newValue: CheckBoxState) => {
    if (this.props.checkboxProps && this.props.checkboxProps.onClick)
      this.props.checkboxProps.onClick(this.props.node, newValue);
  }
}

function doPropsDiffer(props1: TreeNodeProps, props2: TreeNodeProps) {
  return shallowDiffers(props1.highlightProps, props2.highlightProps)
    || shallowDiffers(props1.renderOverrides, props2.renderOverrides)
    || props1.valueRendererManager !== props2.valueRendererManager
    || props1.cellEditing !== props2.cellEditing
    || props1.showDescription !== props2.showDescription
    || shallowDiffers(props1.checkboxProps, props2.checkboxProps)
    || props1.imageLoader !== props2.imageLoader;
}

/** Properties for [[TreeNodeIcon]] React component
 * @public @deprecated Use [[ControlledTree]] instead
 */
export interface TreeNodeIconProps extends React.Attributes {
  node: BeInspireTreeNode<TreeNodeItem>;
  imageLoader: ITreeImageLoader;
}

/** React component that renders tree node icons
 * @public @deprecated Use [[ControlledTree]] instead
 */
export const TreeNodeIcon: React.FunctionComponent<TreeNodeIconProps> = ({ imageLoader, node }) => { // tslint:disable-line:variable-name
  let image: Image | undefined;

  if (node.itree && node.itree.icon)
    image = imageLoader.load(node.itree);
  else if (node.payload && node.payload.icon)
    image = imageLoader.load(node.payload);

  if (!image)
    return null;

  const renderer = new ImageRenderer();
  return <>{renderer.render(image)}</>;
};
