const reactMixin = require('react-mixin');
const Component = require('react').Component

class GraphNode extends Component {
  // static displayName = 'TheGraphNode';
  get displayName() {
    return 'TheGraphNode'
  }

  _addEventListener(node, event, handler, ...args) {
    node.addEventListener(event, handler.bind(this), ...args);
  }

  componentDidMount() {
    // patchGestures();
    var domNode = ReactDOM.findDOMNode(this);

    // Dragging
    this._addEventListener(domNode, 'track', this.trackHandler);

    // Tap to select
    if (this.props.onNodeSelection) {
      this._addEventListener(domNode, 'tap', this.onNodeSelection, true);
    }

    // Context menu
    if (this.props.showContext) {
      this._addEventListener(domNode, 'contextmenu', this.showContext);
      this._addEventListener(domNode, 'hold', this.showContext);
    }
  }

  onNodeSelection(event) {
    // Don't tap app (unselect)
    event.stopPropagation();

    var toggle = (TheGraph.metaKeyPressed || event.pointerType === 'touch');
    this.props.onNodeSelection(this.props.nodeID, this.props.node, toggle);
  }

  _onTrackStart(event) {
    // state — a string indicating the tracking state:
    //  start — fired when tracking is first detected (finger/button down and moved past a pre-set distance threshold)
    //  track — fired while tracking
    //  end — fired when tracking ends

    // Don't drag graph
    event.stopPropagation();

    // Don't change selection
    // event.preventTap();

    // Don't drag under menu
    if (this.props.app.menuShown) {
      return;
    }

    // Don't drag while pinching
    if (this.props.app.pinching) {
      return;
    }

    // Moving a node should only be a single transaction
    if (this.props.export) {
      this.props.graph.startTransaction('moveexport');
    } else {
      this.props.graph.startTransaction('movenode');
    }
  }

  trackHandler(event) {
    // Don't fire on graph
    event.stopPropagation();
    switch (event.detail.state) {
      case 'start':
        this._onTrackStart(event);
        break;
      case 'track':
        this._onTrack(event);
        break;
      case 'end':
        this._onTrackEnd(event);
        break;
    }
  }

  _onTrack(event) {
    var scale = this.props.app.state.scale;
    var detail = event.detail
    var deltaX = Math.round(detail.ddx / scale);
    var deltaY = Math.round(detail.ddy / scale);
    var meta = this.props.node.metadata
    var x = meta.x
    var y = meta.y
    // Fires a change event on fbp-graph graph, which triggers redraw
    var newPos = {
      x: x + deltaX,
      y: y + deltaY,
    }

    if (this.props.export) {
      if (this.props.isIn) {
        this.props.graph.setInportMetadata(this.props.exportKey, newPos);
      } else {
        this.props.graph.setOutportMetadata(this.props.exportKey, newPos);
      }
    } else {
      this.props.graph.setNodeMetadata(this.props.nodeID, newPos);
    }
  }

  _onTrackEnd(event) {
    // Don't fire on graph
    event.stopPropagation();

    var domNode = ReactDOM.findDOMNode(this);

    // Snap to grid
    var snapToGrid = true;
    var snap = TheGraph.config.node.snap / 2;
    if (snapToGrid) {
      var x, y;
      if (this.props.export) {
        var newPos = {
          x: Math.round(this.props.export.metadata.x / snap) * snap,
          y: Math.round(this.props.export.metadata.y / snap) * snap
        };
        if (this.props.isIn) {
          this.props.graph.setInportMetadata(this.props.exportKey, newPos);
        } else {
          this.props.graph.setOutportMetadata(this.props.exportKey, newPos);
        }
      } else {
        this.props.graph.setNodeMetadata(this.props.nodeID, {
          x: Math.round(this.props.node.metadata.x / snap) * snap,
          y: Math.round(this.props.node.metadata.y / snap) * snap
        });
      }
    }

    // Moving a node should only be a single transaction
    if (this.props.export) {
      this.props.graph.endTransaction('moveexport');
    } else {
      this.props.graph.endTransaction('movenode');
    }
  }

  showContext(event) {
    // Don't show native context menu
    event.preventDefault();

    // Don't tap graph on hold event
    event.stopPropagation();
    if (event.preventTap) {
      event.preventTap();
    }

    // Get mouse position
    var x = event.x || event.clientX || 0;
    var y = event.y || event.clientY || 0;

    // App.showContext
    this.props.showContext({
      element: this,
      type: (this.props.export ? (this.props.isIn ? 'graphInport' : 'graphOutport') : 'node'),
      x: x,
      y: y,
      graph: this.props.graph,
      itemKey: (this.props.export ? this.props.exportKey : this.props.nodeID),
      item: (this.props.export ? this.props.export : this.props.node)
    });
  }
  getContext(menu, options, hide) {
    // If this node is an export
    if (this.props.export) {
      return TheGraph.Menu({
        menu: menu,
        options: options,
        triggerHideContext: hide,
        label: this.props.exportKey
      });
    }

    // Absolute position of node
    var x = options.x;
    var y = options.y;
    var scale = this.props.app.state.scale;
    var appX = this.props.app.state.x;
    var appY = this.props.app.state.y;
    var nodeX = (this.props.x + this.props.width / 2) * scale + appX;
    var nodeY = (this.props.y + this.props.height / 2) * scale + appY;
    var deltaX = nodeX - x;
    var deltaY = nodeY - y;
    var ports = this.props.ports;
    var processKey = this.props.nodeID;
    var highlightPort = this.props.highlightPort;

    // If there is a preview edge started, only show connectable ports
    if (this.props.graphView.state.edgePreview) {
      if (this.props.graphView.state.edgePreview.isIn) {
        // Show outputs
        return TheGraph.NodeMenuPorts({
          ports: ports.outports,
          triggerHideContext: hide,
          isIn: false,
          scale: scale,
          processKey: processKey,
          deltaX: deltaX,
          deltaY: deltaY,
          translateX: x,
          translateY: y,
          nodeWidth: this.props.width,
          nodeHeight: this.props.height,
          highlightPort: highlightPort
        });
      } else {
        // Show inputs
        return TheGraph.NodeMenuPorts({
          ports: ports.inports,
          triggerHideContext: hide,
          isIn: true,
          scale: scale,
          processKey: processKey,
          deltaX: deltaX,
          deltaY: deltaY,
          translateX: x,
          translateY: y,
          nodeWidth: this.props.width,
          nodeHeight: this.props.height,
          highlightPort: highlightPort
        });
      }
    }

    // Default, show whole node menu
    return TheGraph.NodeMenu({
      menu: menu,
      options: options,
      triggerHideContext: hide,
      label: this.props.label,
      graph: this.props.graph,
      graphView: this.props.graphView,
      node: this,
      icon: this.props.icon,
      ports: ports,
      process: this.props.node,
      processKey: processKey,
      x: x,
      y: y,
      nodeWidth: this.props.width,
      nodeHeight: this.props.height,
      deltaX: deltaX,
      deltaY: deltaY,
      highlightPort: highlightPort
    });
  }

  getTooltipTrigger() {
    return ReactDOM.findDOMNode(this);
  }

  shouldShowTooltip() {
    return (this.props.app.state.scale < TheGraph.zbpNormal);
  }

  shouldComponentUpdate(nextProps, nextState) {
    // Only rerender if changed
    return (
      nextProps.x !== this.props.x ||
      nextProps.y !== this.props.y ||
      nextProps.icon !== this.props.icon ||
      nextProps.label !== this.props.label ||
      nextProps.sublabel !== this.props.sublabel ||
      nextProps.ports !== this.props.ports ||
      nextProps.selected !== this.props.selected ||
      nextProps.error !== this.props.error ||
      nextProps.highlightPort !== this.props.highlightPort ||
      nextProps.ports.dirty === true
    );
  }

  render() {
    if (this.props.ports.dirty) {
      // This tag is set when an edge or iip changes port colors
      this.props.ports.dirty = false;
    }

    var label = this.props.label;
    var sublabel = this.props.sublabel;
    if (!sublabel || sublabel === label) {
      sublabel = '';
    }
    var x = this.props.x;
    var y = this.props.y;
    var width = this.props.width;
    var height = this.props.height;

    // Ports
    var keys, count;
    var processKey = this.props.nodeID;
    var app = this.props.app;
    var graph = this.props.graph;
    var node = this.props.node;
    var isExport = (this.props.export !== undefined);
    var showContext = this.props.showContext;
    var highlightPort = this.props.highlightPort;

    // Inports
    var inports = this.props.ports.inports;
    keys = Object.keys(inports);
    count = keys.length;
    // Make views
    var inportViews = keys.map(function (key) {
      var info = inports[key];
      var props = {
        app: app,
        graph: graph,
        node: node,
        key: processKey + '.in.' + info.label,
        label: info.label,
        processKey: processKey,
        isIn: true,
        isExport: isExport,
        nodeX: x,
        nodeY: y,
        nodeWidth: width,
        nodeHeight: height,
        x: info.x,
        y: info.y,
        port: {
          process: processKey,
          port: info.label,
          type: info.type
        },
        highlightPort: highlightPort,
        route: info.route,
        showContext: showContext
      };
      return TheGraph.factories.node.createNodePort(props);
    });

    // Outports
    var outports = this.props.ports.outports;
    keys = Object.keys(outports);
    count = keys.length;
    var outportViews = keys.map(function (key) {
      var info = outports[key];
      var props = {
        app: app,
        graph: graph,
        node: node,
        key: processKey + '.out.' + info.label,
        label: info.label,
        processKey: processKey,
        isIn: false,
        isExport: isExport,
        nodeX: x,
        nodeY: y,
        nodeWidth: width,
        nodeHeight: height,
        x: info.x,
        y: info.y,
        port: {
          process: processKey,
          port: info.label,
          type: info.type
        },
        highlightPort: highlightPort,
        route: info.route,
        showContext: showContext
      };
      return TheGraph.factories.node.createNodePort(props);
    });

    // Node Icon
    var icon = TheGraph.FONT_AWESOME[this.props.icon];
    if (!icon) {
      icon = TheGraph.FONT_AWESOME.cog;
    }

    var iconContent;
    if (this.props.iconsvg && this.props.iconsvg !== '') {
      var iconSVGOptions = TheGraph.merge(TheGraph.config.node.iconsvg, {
        src: this.props.iconsvg,
        x: TheGraph.config.nodeRadius - 4,
        y: TheGraph.config.nodeRadius - 4,
        width: this.props.width - 10,
        height: this.props.height - 10
      });
      iconContent = TheGraph.factories.node.createNodeIconSVG.call(this, iconSVGOptions);
    } else {
      var iconOptions = TheGraph.merge(TheGraph.config.node.icon, {
        x: this.props.width / 2,
        y: this.props.height / 2,
        children: icon
      });
      iconContent = TheGraph.factories.node.createNodeIconText.call(this, iconOptions);
    }

    var backgroundRectOptions = TheGraph.merge(TheGraph.config.node.background, {
      width: this.props.width,
      height: this.props.height + 25
    });
    var backgroundRect = TheGraph.factories.node.createNodeBackgroundRect.call(this, backgroundRectOptions);

    var borderRectOptions = TheGraph.merge(TheGraph.config.node.border, {
      width: this.props.width,
      height: this.props.height
    });
    var borderRect = TheGraph.factories.node.createNodeBorderRect.call(this, borderRectOptions);

    var innerRectOptions = TheGraph.merge(TheGraph.config.node.innerRect, {
      width: this.props.width - 6,
      height: this.props.height - 6
    });
    var innerRect = TheGraph.factories.node.createNodeInnerRect.call(this, innerRectOptions);

    var inportsOptions = TheGraph.merge(TheGraph.config.node.inports, {
      children: inportViews
    });
    var inportsGroup = TheGraph.factories.node.createNodeInportsGroup.call(this, inportsOptions);

    var outportsOptions = TheGraph.merge(TheGraph.config.node.outports, {
      children: outportViews
    });
    var outportsGroup = TheGraph.factories.node.createNodeOutportsGroup.call(this, outportsOptions);

    var labelTextOptions = TheGraph.merge(TheGraph.config.node.labelText, {
      x: this.props.width / 2,
      y: this.props.height + 15,
      children: label
    });
    var labelText = TheGraph.factories.node.createNodeLabelText.call(this, labelTextOptions);

    var labelRectX = this.props.width / 2;
    var labelRectY = this.props.height + 15;
    var labelRectOptions = buildLabelRectOptions(14, labelRectX, labelRectY, label.length, TheGraph.config.node.labelRect.className);
    labelRectOptions = TheGraph.merge(TheGraph.config.node.labelRect, labelRectOptions);
    var labelRect = TheGraph.factories.node.createNodeLabelRect.call(this, labelRectOptions);
    var labelGroup = TheGraph.factories.node.createNodeLabelGroup.call(this, TheGraph.config.node.labelBackground, [labelRect, labelText]);

    var sublabelTextOptions = TheGraph.merge(TheGraph.config.node.sublabelText, {
      x: this.props.width / 2,
      y: this.props.height + 30,
      children: sublabel
    });
    var sublabelText = TheGraph.factories.node.createNodeSublabelText.call(this, sublabelTextOptions);

    var sublabelRectX = this.props.width / 2;
    var sublabelRectY = this.props.height + 30;
    var sublabelRectOptions = buildLabelRectOptions(9, sublabelRectX, sublabelRectY, sublabel.length, TheGraph.config.node.sublabelRect.className);
    sublabelRectOptions = TheGraph.merge(TheGraph.config.node.sublabelRect, sublabelRectOptions);
    var sublabelRect = TheGraph.factories.node.createNodeSublabelRect.call(this, sublabelRectOptions);
    var sublabelGroup = TheGraph.factories.node.createNodeSublabelGroup.call(this, TheGraph.config.node.sublabelBackground, [sublabelRect, sublabelText]);

    var nodeContents = [
      backgroundRect,
      borderRect,
      innerRect,
      iconContent,
      inportsGroup,
      outportsGroup,
      labelGroup,
      sublabelGroup,
    ];

    var nodeOptions = {
      className: 'node drag' +
        (this.props.selected ? ' selected' : '') +
        (this.props.error ? ' error' : ''),
      name: this.props.nodeID,
      key: this.props.nodeID,
      title: label,
      transform: 'translate(' + x + ',' + y + ')'
    };
    nodeOptions = TheGraph.merge(TheGraph.config.node.container, nodeOptions);

    return TheGraph.factories.node.createNodeGroup.call(this, nodeOptions, nodeContents);
  }
}

function buildLabelRectOptions(height, x, y, len, className) {

  var width = len * height * 2 / 3;
  var radius = height / 2;
  x -= width / 2;
  y -= height / 2;

  var result = {
    className: className,
    height: height * 1.1,
    width: width,
    rx: radius,
    ry: radius,
    x: x,
    y: y
  };

  return result;
}

var ToolTipMixin = require('../mixins/tooltip')
reactMixin.bindClass(GraphNode, ToolTipMixin)

module.exports = GraphNode