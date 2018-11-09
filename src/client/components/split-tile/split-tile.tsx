/*
 * Copyright 2015-2016 Imply Data, Inc.
 * Copyright 2017-2018 Allegro.pl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as Q from "q";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Clicker } from "../../../common/models/clicker/clicker";
import { Dimension } from "../../../common/models/dimension/dimension";
import { DragPosition } from "../../../common/models/drag-position/drag-position";
import { Essence, VisStrategy } from "../../../common/models/essence/essence";
import { Split } from "../../../common/models/split/split";
import { Stage } from "../../../common/models/stage/stage";
import { CORE_ITEM_GAP, CORE_ITEM_WIDTH, STRINGS } from "../../config/constants";
import { classNames, findParentWithClass, getXFromEvent, isInside, setDragGhost, transformStyle, uniqueId } from "../../utils/dom/dom";
import { DragManager } from "../../utils/drag-manager/drag-manager";
import { getMaxItems, SECTION_WIDTH } from "../../utils/pill-tile/pill-tile";
import { BubbleMenu } from "../bubble-menu/bubble-menu";
import { FancyDragIndicator } from "../fancy-drag-indicator/fancy-drag-indicator";
import { SplitMenu } from "../split-menu/split-menu";
import { SvgIcon } from "../svg-icon/svg-icon";
import "./split-tile.scss";

const SPLIT_CLASS_NAME = "split";

export interface SplitTileProps {
  clicker: Clicker;
  essence: Essence;
  menuStage: Stage;
}

export interface SplitTileState {
  menuOpenOn?: Element;
  menuDimension?: Dimension;
  menuSplit?: Split;
  dragPosition?: DragPosition;
  overflowMenuOpenOn?: Element;
  maxItems?: number;
  menuInside?: Element;
}

export class SplitTile extends React.Component<SplitTileProps, SplitTileState> {

  private static canDrop(): boolean {
    return Boolean(DragManager.getDragSplit() || DragManager.getDragDimension());
  }

  private readonly overflowMenuId = uniqueId("overflow-menu-");
  private overflowMenuDeferred: Q.Deferred<Element>;

  state: SplitTileState = {
    menuOpenOn: null,
    menuDimension: null,
    dragPosition: null,
    maxItems: null
  };

  componentWillReceiveProps(nextProps: SplitTileProps) {
    const { menuStage, essence } = nextProps;
    const { splits } = essence;

    if (menuStage) {
      const newMaxItems = getMaxItems(menuStage.width, splits.splits.count());
      if (newMaxItems !== this.state.maxItems) {
        this.setState({
          menuOpenOn: null,
          menuDimension: null,
          overflowMenuOpenOn: null,
          maxItems: newMaxItems
        });
      }
    }

  }

  componentDidUpdate() {
    const { overflowMenuOpenOn } = this.state;

    if (overflowMenuOpenOn) {
      const overflowMenu = this.getOverflowMenu();
      if (overflowMenu) this.overflowMenuDeferred.resolve(overflowMenu);
    }
  }

  selectDimensionSplit = (dimension: Dimension, split: Split, e: React.MouseEvent<HTMLElement>) => {
    const target = findParentWithClass(e.target as Element, SPLIT_CLASS_NAME);
    this.openMenu(dimension, split, target);
  }

  openMenu(dimension: Dimension, split: Split, target: Element) {
    const { menuOpenOn } = this.state;
    if (menuOpenOn === target) {
      this.closeMenu();
      return;
    }

    const overflowMenu = this.getOverflowMenu();
    let menuInside: Element = null;
    if (overflowMenu && isInside(target, overflowMenu)) {
      menuInside = overflowMenu;
    }

    this.setState({
      menuOpenOn: target,
      menuDimension: dimension,
      menuSplit: split,
      menuInside
    });
  }

  closeMenu = () => {
    const { menuOpenOn } = this.state;
    if (!menuOpenOn) return;
    this.setState({
      menuOpenOn: null,
      menuDimension: null,
      menuInside: null,
      menuSplit: null
    });
  }

  getOverflowMenu(): Element {
    return document.getElementById(this.overflowMenuId);
  }

  openOverflowMenu(target: Element): Q.Promise<any> {
    if (!target) return Q(null);
    var { overflowMenuOpenOn } = this.state;

    if (overflowMenuOpenOn === target) {
      this.closeOverflowMenu();
      return Q(null);
    }

    this.overflowMenuDeferred = Q.defer() as Q.Deferred<Element>;
    this.setState({ overflowMenuOpenOn: target });
    return this.overflowMenuDeferred.promise;
  }

  closeOverflowMenu = () => {
    const { overflowMenuOpenOn } = this.state;
    if (!overflowMenuOpenOn) return;
    this.setState({
      overflowMenuOpenOn: null
    });
  }

  removeSplit = (split: Split, e: React.MouseEvent<HTMLElement>) => {
    const { clicker } = this.props;
    clicker.removeSplit(split, VisStrategy.FairGame);
    this.closeMenu();
    this.closeOverflowMenu();
    e.stopPropagation();
  }

  dragStart = (dimension: Dimension, split: Split, splitIndex: number, e: React.DragEvent<HTMLElement>) => {
    const dataTransfer = e.dataTransfer;
    dataTransfer.effectAllowed = "all";
    dataTransfer.setData("text/plain", dimension.title);

    DragManager.setDragSplit(split, "split-tile");
    DragManager.setDragDimension(dimension, "split-tile");
    setDragGhost(dataTransfer, dimension.title);

    this.closeMenu();
    this.closeOverflowMenu();
  }

  calculateDragPosition(e: React.DragEvent<HTMLElement>): DragPosition {
    const { essence } = this.props;
    const numItems = essence.splits.length();
    const rect = ReactDOM.findDOMNode(this.refs["items"]).getBoundingClientRect();
    const x = getXFromEvent(e);
    const offset = x - rect.left;
    return DragPosition.calculateFromOffset(offset, numItems, CORE_ITEM_WIDTH, CORE_ITEM_GAP);
  }

  dragEnter = (e: React.DragEvent<HTMLElement>) => {
    if (!SplitTile.canDrop()) return;
    e.preventDefault();
    this.setState({
      dragPosition: this.calculateDragPosition(e)
    });
  }

  dragOver = (e: React.DragEvent<HTMLElement>) => {
    if (!SplitTile.canDrop()) return;
    e.dataTransfer.dropEffect = "move";
    e.preventDefault();
    const dragPosition = this.calculateDragPosition(e);
    if (dragPosition.equals(this.state.dragPosition)) return;
    this.setState({ dragPosition });
  }

  dragLeave = () => {
    if (!SplitTile.canDrop()) return;
    this.setState({
      dragPosition: null
    });
  }

  drop = (e: React.DragEvent<HTMLElement>) => {
    if (!SplitTile.canDrop()) return;
    e.preventDefault();
    const { clicker, essence: { splits } } = this.props;
    const { maxItems } = this.state;

    let newSplitCombine: Split = null;
    if (DragManager.getDragSplit()) {
      newSplitCombine = DragManager.getDragSplit();
    } else if (DragManager.getDragDimension()) {
      newSplitCombine = Split.fromDimension(DragManager.getDragDimension());
    }

    if (newSplitCombine) {
      let dragPosition = this.calculateDragPosition(e);

      if (dragPosition.replace === maxItems) {
        dragPosition = new DragPosition({ insert: dragPosition.replace });
      }

      if (dragPosition.isReplace()) {
        clicker.changeSplits(splits.replaceByIndex(dragPosition.replace, newSplitCombine), VisStrategy.FairGame);
      } else {
        clicker.changeSplits(splits.insertByIndex(dragPosition.insert, newSplitCombine), VisStrategy.FairGame);
      }
    }

    this.setState({
      dragPosition: null
    });
  }

  // This will be called externally
  splitMenuRequest(dimension: Dimension) {
    const { splits } = this.props.essence;
    const split = splits.findSplitForDimension(dimension);
    if (!split) return;
    const targetRef = this.refs[dimension.name];
    if (!targetRef) return;
    const target = ReactDOM.findDOMNode(targetRef);
    if (!target) return;
    this.openMenu(dimension, split, target);
  }

  overflowButtonTarget(): Element {
    return ReactDOM.findDOMNode(this.refs["overflow"]);
  }

  overflowButtonClick = () => {
    this.openOverflowMenu(this.overflowButtonTarget());
  }

  renderMenu(): JSX.Element {
    const { essence, clicker, menuStage } = this.props;
    const { menuOpenOn, menuDimension, menuSplit, menuInside, overflowMenuOpenOn } = this.state;
    if (!menuDimension) return null;

    return <SplitMenu
      clicker={clicker}
      essence={essence}
      containerStage={overflowMenuOpenOn ? null : menuStage}
      openOn={menuOpenOn}
      dimension={menuDimension}
      split={menuSplit}
      onClose={this.closeMenu}
      inside={menuInside}
    />;
  }

  renderOverflowMenu(items: Split[]): JSX.Element {
    const { overflowMenuOpenOn } = this.state;
    if (!overflowMenuOpenOn) return null;

    const segmentHeight = 29 + CORE_ITEM_GAP;

    const splitItems = items.map((item, i) => {
      const style = transformStyle(0, CORE_ITEM_GAP + i * segmentHeight);
      return this.renderSplit(item, style, i);
    });

    return <BubbleMenu
      className="overflow-menu"
      id={this.overflowMenuId}
      direction="down"
      stage={Stage.fromSize(208, CORE_ITEM_GAP + (splitItems.length * segmentHeight))}
      fixedSize={true}
      openOn={overflowMenuOpenOn}
      onClose={this.closeOverflowMenu}
    >
      {splitItems}
    </BubbleMenu>;
  }

  renderOverflow(items: Split[], itemX: number): JSX.Element {
    const { essence: { dataCube } } = this.props;
    const style = transformStyle(itemX, 0);
    return <div
      className={classNames("overflow", { "all-continuous": items.every(item => dataCube.getDimension(item.reference).isContinuous()) })}
      ref="overflow"
      key="overflow"
      style={style}
      onClick={this.overflowButtonClick}
    >
      <div className="count">{"+" + items.length}</div>
      {this.renderOverflowMenu(items)}
    </div>;
  }

  renderSplit(split: Split, style: React.CSSProperties, i: number) {
    const { essence: { dataCube } } = this.props;
    const { menuDimension } = this.state;

    const dimension = dataCube.getDimension(split.reference);
    if (!dimension) throw new Error("dimension not found");
    const dimensionName = dimension.name;

    const classNames = [
      SPLIT_CLASS_NAME,
      "type-" + dimension.className
    ];
    if (dimension === menuDimension) classNames.push("selected");
    return <div
      className={classNames.join(" ")}
      key={split.toKey()}
      ref={dimensionName}
      draggable={true}
      onClick={(e: React.MouseEvent<HTMLElement>) => this.selectDimensionSplit(dimension, split, e)}
      onDragStart={(e: React.DragEvent<HTMLElement>) => this.dragStart(dimension, split, i, e)}
      style={style}
    >
      <div className="reading">{split.getTitle(dataCube.getDimension(split.reference))}</div>
      <div className="remove"
           onClick={(e: React.MouseEvent<HTMLElement>) => this.removeSplit(split, e)}>
        <SvgIcon svg={require("../../icons/x.svg")} />
      </div>
    </div>;
  }

  render() {
    const { essence: { splits } } = this.props;
    const { dragPosition, maxItems } = this.state;

    const splitsArray = splits.splits.toArray();

    const splitItems = splitsArray.slice(0, maxItems).map((split, i) => {
      const style = transformStyle(i * SECTION_WIDTH, 0);
      return this.renderSplit(split, style, i);
    }, this);

    const overflowItems = splitsArray.slice(maxItems);
    if (overflowItems.length > 0) {
      const overFlowStart = splitItems.length * SECTION_WIDTH;
      splitItems.push(this.renderOverflow(overflowItems, overFlowStart));
    }

    return <div
      className="split-tile"
      onDragEnter={this.dragEnter}
    >
      <div className="title">{STRINGS.split}</div>
      <div className="items" ref="items">
        {splitItems}
      </div>
      {dragPosition ? <FancyDragIndicator dragPosition={dragPosition} /> : null}
      {dragPosition ? <div
        className="drag-mask"
        onDragOver={this.dragOver}
        onDragLeave={this.dragLeave}
        onDragExit={this.dragLeave}
        onDrop={this.drop}
      /> : null}
      {this.renderMenu()}
    </div>;
  }
}
