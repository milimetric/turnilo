require('./link-view.css');

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { List } from 'immutable';
import { Expression } from 'plywood';
import { Colors, Clicker, DataSource, Dimension, Essence, Filter, Stage, Manifest, Measure,
  SplitCombine, Splits, VisStrategy, VisualizationProps, LinkViewConfig, LinkItem, User } from '../../../common/models/index';
// import { ... } from '../../config/constants';

import { LinkHeaderBar } from '../link-header-bar/link-header-bar';
import { DimensionMeasurePanel } from '../dimension-measure-panel/dimension-measure-panel';
import { ManualFallback } from '../manual-fallback/manual-fallback';
import { DropIndicator } from '../drop-indicator/drop-indicator';
import { PinboardPanel } from '../pinboard-panel/pinboard-panel';

import { visualizations } from '../../visualizations/index';

export interface LinkViewProps extends React.Props<any> {
  linkViewConfig: LinkViewConfig;
  user?: User;
  hash: string;
  updateHash: Function;
  getUrlPrefix?: Function;
  onNavClick?: Function;
}

export interface LinkViewState {
  linkItem?: LinkItem;
  essence?: Essence;
  visualizationStage?: Stage;
  menuStage?: Stage;
}

export class LinkView extends React.Component<LinkViewProps, LinkViewState> {
  private clicker: Clicker;

  constructor() {
    super();
    this.state = {
      essence: null
    };

    var clicker = {
      changeFilter: (filter: Filter, colors?: Colors) => {
        var { essence } = this.state;
        essence = essence.changeFilter(filter);
        if (colors) essence = essence.changeColors(colors);
        this.setState({ essence });
      },
      changeTimeSelection: (selection: Expression) => {
        var { essence } = this.state;
        this.setState({ essence: essence.changeTimeSelection(selection) });
      },
      changeSplits: (splits: Splits, strategy: VisStrategy, colors?: Colors) => {
        var { essence } = this.state;
        if (colors) essence = essence.changeColors(colors);
        this.setState({ essence: essence.changeSplits(splits, strategy) });
      },
      changeSplit: (split: SplitCombine, strategy: VisStrategy) => {
        var { essence } = this.state;
        this.setState({ essence: essence.changeSplit(split, strategy) });
      },
      addSplit: (split: SplitCombine, strategy: VisStrategy) => {
        var { essence } = this.state;
        this.setState({ essence: essence.addSplit(split, strategy) });
      },
      removeSplit: (split: SplitCombine, strategy: VisStrategy) => {
        var { essence } = this.state;
        this.setState({ essence: essence.removeSplit(split, strategy) });
      },
      changeColors: (colors: Colors) => {
        var { essence } = this.state;
        this.setState({ essence: essence.changeColors(colors) });
      },
      changeVisualization: (visualization: Manifest) => {
        var { essence } = this.state;
        this.setState({ essence: essence.changeVisualization(visualization) });
      },
      changePinnedSortMeasure: (measure: Measure) => {
        var { essence } = this.state;
        this.setState({ essence: essence.changePinnedSortMeasure(measure) });
      },
      toggleMeasure: (measure: Measure) => {
        var { essence } = this.state;
        this.setState({ essence: essence.toggleMeasure(measure) });
      },
      changeHighlight: (owner: string, delta: Filter) => {
        var { essence } = this.state;
        this.setState({ essence: essence.changeHighlight(owner, delta) });
      },
      acceptHighlight: () => {
        var { essence } = this.state;
        this.setState({ essence: essence.acceptHighlight() });
      },
      dropHighlight: () => {
        var { essence } = this.state;
        this.setState({ essence: essence.dropHighlight() });
      }
    };
    this.clicker = clicker;
    this.globalResizeListener = this.globalResizeListener.bind(this);
  }

  componentWillMount() {
    var { hash, linkViewConfig, updateHash } = this.props;

    var linkItem = linkViewConfig.first();

    //var essence = this.getEssenceFromHash(hash);
    //if (!essence) {
    //  essence = this.getEssenceFromDataSource(dataSource);
    //  updateHash(essence.toHash());
    //}
    this.setState({
      linkItem,
      essence: linkItem.essence
    });
  }

  componentDidMount() {
    window.addEventListener('resize', this.globalResizeListener);
    this.globalResizeListener();
  }

  componentWillReceiveProps(nextProps: LinkViewProps) {
    const { hash } = this.props;
    const { essence } = this.state;

    if (hash !== nextProps.hash) {
      //var hashEssence = this.getEssenceFromHash(nextProps.hash);
      //this.setState({ essence: hashEssence });
    }
  }

  componentWillUpdate(nextProps: LinkViewProps, nextState: LinkViewState): void {
    const { updateHash } = this.props;
    const { linkItem } = this.state;
    if (updateHash && !nextState.linkItem.equals(linkItem)) {
      updateHash(nextState.linkItem.name);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.globalResizeListener);
  }

  globalResizeListener() {
    var { container, visualization } = this.refs;
    var containerDOM = ReactDOM.findDOMNode(container);
    var visualizationDOM = ReactDOM.findDOMNode(visualization);
    if (!containerDOM || !visualizationDOM) return;
    this.setState({
      menuStage: Stage.fromClientRect(containerDOM.getBoundingClientRect()),
      visualizationStage: Stage.fromClientRect(visualizationDOM.getBoundingClientRect())
    });
  }

  selectLinkItem(linkItem: LinkItem) {
    this.setState({
      linkItem,
      essence: linkItem.essence
    });
  }

  renderLinkPanel() {
    const { linkViewConfig } = this.props;
    const { linkItem } = this.state;

    var groupId = 0;
    var lastGroup: string = null;
    var items: JSX.Element[] = [];
    linkViewConfig.linkItems.forEach(li => {
      // Add a group header if needed
      if (lastGroup !== li.group) {
        items.push(<div
          className="link-group-title"
          key={'group_' + groupId}
        >
          {li.group}
        </div>);
        groupId++;
        lastGroup = li.group;
      }

      items.push(<div
        className={'link-item' + (li === linkItem ? ' selected' : '')}
        key={'li_' + li.name}
        onClick={this.selectLinkItem.bind(this, li)}
      >
        {li.title}
      </div>);
    });

    return <div className="link-panel">{items}</div>;
  }

  render() {
    var clicker = this.clicker;

    var { getUrlPrefix, onNavClick, linkViewConfig, user } = this.props;
    var { linkItem, essence, visualizationStage } = this.state;

    if (!linkItem) return null;

    var { visualization } = essence;

    var visElement: JSX.Element = null;
    if (essence.visResolve.isReady() && visualizationStage) {
      var visProps: VisualizationProps = {
        clicker,
        essence,
        stage: visualizationStage
      };

      visElement = React.createElement(visualization as any, visProps);
    }

    var manualFallback: JSX.Element = null;
    if (essence.visResolve.isManual()) {
      manualFallback = React.createElement(ManualFallback, {
        clicker,
        essence
      });
    }

    return <div className='link-view'>
      <LinkHeaderBar
        title={linkViewConfig.title}
        user={user}
        onNavClick={onNavClick}
        getUrlPrefix={getUrlPrefix}
      />
      <div className="container" ref='container'>
        {this.renderLinkPanel()}
        <div className='center-panel'>
          <div className='center-top-bar'>
            <div className='link-title'>{linkItem.title}</div>
            <div className='link-description'>{linkItem.description}</div>
          </div>
          <div className='center-main'>
            <div className='visualization' ref='visualization'>{visElement}</div>
            {manualFallback}
          </div>
        </div>
        <PinboardPanel
          clicker={clicker}
          essence={essence}
          getUrlPrefix={getUrlPrefix}
        />
      </div>
    </div>;
  }
}
