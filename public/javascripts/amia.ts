/// <reference path='typings/jquery.d.ts' />
/// <reference path='typings/d3.d.ts' />

declare var AMIA: any;

module AmiaGraph {
  interface Edge extends D3.Layout.GraphLinkForce {
    id: number;
    name: string;
    description: string;
    node_from: number;
    node_to: number;
    source: Node;
    target: Node;
  }
  interface Node extends D3.Layout.GraphNodeForce {
    id: number;
    name: string;
    photo: string;
    x: number;
    y: number;
    radius: number;
    description: string;
    width: number;
    height: number;
    year : number;
    month : number;
    day : number;
  }

  var sources = null;
  var isDragging = false;
  var nodes: { [index: number]: Node; };
  var edges: { [index: number]: Edge; };
  var edgesG: D3.Selection;
  var nodesG: D3.Selection;
  var edge: D3.UpdateSelection;
  var node: D3.UpdateSelection;
  var zoomBehavior : D3.Behavior.Zoom;
  var zoomed : (data: any , index?: number) => any ;
  var scaleX : D3.Scale.LinearScale;
  var scaleY : D3.Scale.LinearScale;
  var selector: string = '#graph';

  var width: number;
  var height: number;
  var defaultWidth = 30;


  var curEdgesData: Edge[];
  var curNodesData: Node[];
  var linkedByIndex: { [index: number]: string; };



  var force: D3.Layout.ForceLayout;


  var network: any;
  var $node: JQuery;
  var $edge: JQuery;
  var $what: JQuery;
  var $results : JQuery;
  var route = '/';
  var drag;
  var entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': '&quot;',
      "'": '&#39;',
      "/": '&#x2F;'
    };

  function init(initRoute) {
    route = initRoute;
    width = $(selector).width();
    height = $(selector).height();
    scaleX = d3.scale.linear().domain([-width / 2, width / 2]).range([width, 0]);
    scaleY = d3.scale.linear().domain([-height / 2, height / 2]).range([height, 0]);
    curEdgesData = [];
    curNodesData = [];
    linkedByIndex = {};
    force = d3.layout.force();
    $results = $('.js-result-list');
    $node = $('#nodeInfoTpl');
    $edge = $('#edgeInfoTpl');
    $('.js-start').on('click', e => {
      e.preventDefault();
      $('#loading').addClass('remove');
      setTimeout(_ => {
        doRoute();
      }, 1500);
    });
    $('body').on('click', '.js-zoom',uiZoom);
    $('body').on('click', '.popupGraph .close',hidePopup);
    $('#whatis').on('click', _ => {
      hidePopup();
      openPopup($('#what'));
    });

    setupSearch();
  }
  function uiZoom(e) {
    console.log('test', e);
    var $e = $(e.currentTarget);
    var zoomIncrement = parseInt($e.data('zoom'), 10) / 30;
    console.log('zoomIncrement', zoomIncrement)
    var actualZoom = zoomBehavior.scale();
      zoomBehavior
        .scale(actualZoom + zoomIncrement)
        .event(d3.select('#graph'));
  }

  function escape(str) {
    return String(str).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });;
  }

  function setupSearch() {
    var makeNodeResult = (node : Node) => {
      var ret = '<div class="result js-link" data-type="node" data-id="'+node.id+'">';
      ret += '<span class="node_from">' + '<img src="'+ img(node) + '" />' + '</span>';
      ret +=  escape(node.name)
      ret += ' ' + makeNodeDate(node);
      ret += '</div>'
      return ret;
    };

    var makeEdgeResult = (edge : Edge) => {
      var ret = '<div class="result js-link" data-type="edge" data-id="'+edge.id+'">';
      ret +=  '<span class="node_from">' + '<img src="'+ img(edge.source) + '" />' + '</span> ⇾ ';
      ret +=  escape(edge.name);
      ret +=  ' ⇾ <span class="node_to">' + '<img src="'+ img(edge.target) + '" />' + '</span>';
      ret +=   '</div>';
      return ret;
    };
    var removeAccents = function(str){
          return str
             .replace(/[áàãâä]/gi,"a")
             .replace(/[éè¨ê]/gi,"e")
             .replace(/[íìïî]/gi,"i")
             .replace(/[óòöôõ]/gi,"o")
             .replace(/[úùüû]/gi, "u")
             .replace(/[ç]/gi, "c")
             .replace(/[ñ]/gi, "n")
             .replace(/[^a-zA-Z0-9]/g," ");
    };
    var isMatch = (terms, phrase) => {
      var lowerPhrase = removeAccents(phrase.toLowerCase());
      for (var i = 0; i < terms.length; i++) {
        if (lowerPhrase.indexOf(terms[i]) !== -1) {
          return true;
        }
      }
      return false;
    };
    $('body').on('click', '.js-link', (e) => {
      var r = $(e.currentTarget)
      if (r.data('type') === 'node') {
        showNodeInfo(parseInt(r.data('id'), 10))
      } else {
        showEdgeInfo(parseInt(r.data('id'), 10))
      }
    });
    $('body').on('input', '.js-search', (e) => {
      var term = $.trim($(e.currentTarget).val());
      var terms = term.toLowerCase().split(" ").map(removeAccents);
      var results = '';
      if (term.length === 0) {
        $results.hide('fast');
        return;
      }
      Object.keys(nodes).forEach((i, num) => {
        var n = nodes[i];
        if (isMatch(terms, n.name)) {
          results += '<div class="r">'+makeNodeResult(n) + '</div>';
        }
      });

      Object.keys(edges).forEach(i => {
        var l = edges[i];
        if (isMatch(terms, l.name) || isMatch(terms, l.source.name) || isMatch(terms, l.target.name)) {
          results += '<div class="r">' + makeEdgeResult(l) + '</div>';
        }
      });
      $results.html(results).show('fast');
    });
  }
  function cleanHash() {
    var scrollV, scrollH,
    loc = window.location;
    if ("pushState" in history) {
      history.pushState("", document.title, loc.pathname + loc.search);
      return;
    }
    loc.hash = "";
  }

  function makeNodeDate(node : Node) : string {
    var fields = [];
    if (node.day)
      fields.push(node.day);
    if (node.month)
      fields.push(node.month);
    if (node.year)
      fields.push(node.year);
    return fields.join('/');
  }

  function makeSources(sources : string[]) : string {
    if (sources.length === 0) {
      return '<p>Aún no hay fuentes citadas.</p>'
    }
    var str = '';
    str += '<ul>';
    str += sources.map((source) => {
      return '<li><a title="Visitar fuente" target="_blank" href="'+source+'">'+source+'</a></li>';
    }).join('');
    str += '</ul>';
    return str;
  }

  function zoomGoTo(x, y, finalScale) {
    var actualScale = zoomBehavior.scale();
    var zX=  zoomBehavior.translate()[0];
    var zY = zoomBehavior.translate()[1];
    var newX = (width  / 2   - x   ) * finalScale  - width;
    var newY = (height / 2   - y   ) * finalScale  - height;
    d3.transition().duration(1500).tween("zoom", function(t) {
          var iX =  d3.interpolate(zX, newX);
          var iY =  d3.interpolate(zY, newY);
          var middlePoint = -9;
          var iZOut =  d3.interpolate(actualScale, middlePoint);
          var iZIn =  d3.interpolate(middlePoint, finalScale);
          var iZ =  d3.interpolate(actualScale, finalScale);
          //var iZ = (t) => {if (t < 0.5) return iZOut(t); else return iZIn(t); };
          return function(t) {
            zoomBehavior
              .scale(iZ(t))
              .translate([iX(t), iY(t)])
              .event(d3.select('#graph'));
            forceTick();
          };
        });
  }

  function showNodeInfo(nodeId : number) {
    hidePopup();
    var node = nodes[nodeId];
    console.log('showNodeInfo', node.x, node.y);
    zoomGoTo(node.x, node.y, 3);



    if (!node) { cleanHash(); return; }
    var $nodeClone = $node.clone();
    $nodeClone.attr('id', '');
    $nodeClone.addClass('js-remove-after');
    $nodeClone.appendTo('body');
    $nodeClone.find('h2 .title').html(node.name);
    $nodeClone.find('h2 .date').html(makeNodeDate(node));
    $nodeClone.find('.sources').html(makeSources(sources.nodes[nodeId]));
    $nodeClone.find('.image img').attr('src', img(node));
    $nodeClone.find('.description').html(node.description);

    Object.keys(edges).forEach(i => {
      var l : Edge = edges[i];
      if (l.node_from === nodeId || l.node_to === nodeId) {
          var $edgeClone = $nodeClone.find('.relations .relation:first').clone();
          $edgeClone.find('.middle').data('id', l.id);
          $edgeClone.find('.relTitle').html(l.name);
          $edgeClone.find('.node_from').data('id', l.source.id);
          $edgeClone.find('.node_from .name').html(l.source.name)
          $edgeClone.find('.node_from img').attr('src', img(l.source));
          $edgeClone.find('.node_to .name').html(l.target.name);
          $edgeClone.find('.node_to img').attr('src', img(l.target));
          $edgeClone.find('.node_to').data('id', l.target.id);
          $nodeClone.find('.relations').append($edgeClone.show());
      }
    })


    openPopup($nodeClone);
    window.location.hash = '/node/' + nodeId;
  }

  function openPopup($e: JQuery) {
    setTimeout(_ => {
      $results.hide('slow');
      $e.addClass('active');
      $e.css('max-height', $(selector).height() - 125);
    }, 0)
  }

  function hidePopup() {
    cleanHash();
    $('.popupGraph').removeClass('active');
    var $e = $('.popupGraph.js-remove-after');
    if ($e.length) {
      setTimeout(_ => { $e.remove(); }, 2000);
    }
  }

  function showEdgeInfo(edgeId : number) {
    hidePopup();
    var edge = edges[edgeId];
    if (!edge) { cleanHash(); return; }
    var from = nodes[edge.node_from];
    var to = nodes[edge.node_to];
    var $edgeClone = $edge.clone();
    zoomGoTo((from.x + to.x ) / 2, (from.y + to.y ) / 2, 3);
    $edgeClone.addClass('js-remove-after');
    $edgeClone.find('.title').html(edge.name);
    $edgeClone.find('.middle').data('id', edge.id);
    $edgeClone.find('.node_from').data('id', from.id);
    $edgeClone.find('.node_from .name').html(from.name)
    $edgeClone.find('.node_from img').attr('src', img(from));
    $edgeClone.find('.node_to .name').html(to.name);
    $edgeClone.find('.node_to img').attr('src', img(to));
    $edgeClone.find('.node_to').data('id', to.id);
    $edgeClone.find('.description').html(edge.description);
    $edgeClone.find('.sources').html(makeSources(sources.edges[edgeId]));
    $edgeClone.appendTo('body');
    openPopup($edgeClone);
    window.location.hash = '/edge/' + edgeId;
  }

  function img(node): string {
    return '/' + AMIA.options['dir-uploads'] + '/' + node.photo;
  }
  function doRoute() {
    var matched = null;
    if (matched = route.match("/node/([0-9]+)")) {
      showNodeInfo(parseInt(matched[1], 10));
    } else if(matched = route.match("/edge/([0-9]+)")) {
      showEdgeInfo(parseInt(matched[1], 10));
    } else {
      cleanHash();
    }
  }
  function start(): void {
    $.ajax('json-data', { dataType: 'json' }).done(data => {
      sources = data.sources;
      nodes = data.nodes;
      edges = data.edges;
      startWidthData();
    });
  }

  function setupData(): void {
    var maxRadius = 90;
    var minRadius = 10;
    var maxRelationsNode = 0;
    var relationsByNode : any = {};
    Object.keys(nodes).forEach((i, num) => {
      var n = nodes[i];
      n.x = n.y = Math.floor(Math.random() * width);
      n.y = Math.floor(Math.random() * height);
      n.width = n.height = maxRadius;
      n.value = n.radius = n.width / 2 ;
      relationsByNode[i] = 1;
    });

    Object.keys(edges).forEach(i => {
      var l = edges[i];
      l.source = nodes[l.node_from];
      l.target = nodes[l.node_to];
      linkedByIndex[l.node_from + "," + l.node_to] = 1;
      relationsByNode[l.node_from]++;
      relationsByNode[l.node_to]++;
      if (maxRelationsNode < relationsByNode[l.node_to])
        maxRelationsNode = relationsByNode[l.node_to];
      if (maxRelationsNode < relationsByNode[l.node_from])
        maxRelationsNode = relationsByNode[l.node_from];
    });
    Object.keys(nodes).forEach((i, num) => {
      var n = nodes[i];
      var newRadius = n.radius * (relationsByNode[i] / maxRelationsNode);
      if (newRadius < minRadius) {
        newRadius = minRadius;
      }
      n.value = n.radius = newRadius;
      n.width = n.height = n.radius * 2;
    });

  }

  function filterNodes(nodes: { [index: number]: Node; }) {
    return d3.values(nodes);
  }

  function filterEdges(edges: { [index: number]: Edge; }, nodes?: { [index: number]: Node; }) {
    return d3.values(edges);
  }

  function isConnected(a, b): boolean {
    return linkedByIndex[a.index + "," + b.index] || linkedByIndex[b.index + "," + a.index];
  }
  function activeNode(d) {
    node.classed("node-active", function(o) {
      var thisOpacity = isConnected(d, o) ? true : false;
      this.setAttribute('fill-opacity', thisOpacity);
      return thisOpacity;
    });

    edge.classed("edge-active", function(o) {
      return o.source === d || o.target === d ? true : false;
    });

    d3.select(this).classed("node-active", true);
    d3.select(this).select("circle").transition()
      .duration(450)
      .attr("r", d.radius * 1.1);
  }
  function deactiveNode(d) {
    node.classed("node-active", false);
    edge.classed("edge-active", false);
    d3.select(this).select("circle").transition()
      .duration(750)
      .attr("r", d.radius);
  }
  function setupNodes() {
    node = nodesG.selectAll(".node").data(curNodesData, function(d) {
      return d.id;
    });
    var g = node.enter()

      .append("g")
      .attr("class", "node").call(drag);

    g.append("circle")
      .attr("cx", d => { return d.radius; })
      .attr("cy", d => { return d.radius; })
      .attr("r", d => { return d.radius; })

    g.append('image')
      .attr("xlink:href", d => {
        return img(d);
      })
      .attr("clip-path", d => { return "url(#clipCircle-"+d.id+")"; } )
      .attr("width", d => { return d.width; })
      .attr("height", d => { return d.height; });

    g.append('text')
      .attr('y', d => { return d.height + d.radius / 2 })
      .attr('x', d => { return d.radius / 2 * -1 })
      .attr('font-size', d => { return (d.radius * 0.3) + "px" })
      .text(d => { return d.name; })

      node.on("mouseover", activeNode)
      .on("mouseout", deactiveNode)
      .on('click', function(d) {
        if (d3.event.defaultPrevented) return; //
        var self = this;
        activeNode.call(self, d);
        if (d) {
          showNodeInfo(d.id);
        }
      })


    node.exit().remove();
  }

  function setupEdges() {
    edge = edgesG.selectAll(".edge").data(curEdgesData, function(d) {
      return d.source.id + "_" + d.target.id;
    });
    var g = edge.enter().append('g').attr('class', 'edge');
    var click = function(d) {
        if (d) {
          showEdgeInfo(d.id);
        }
    };


    g.append("line").on('click', click)
      .attr("x1", function(d) {
        return d.source.x;
      }).attr("y1", function(d) {
        return d.source.y;
      }).attr("x2", function(d) {
        return d.target.x;
      }).attr("y2", function(d) {
        return d.target.y;
      });
    g.append('text')
    .on('click', click)
    .text(d => { return d.name; })

    g.on('click', click)

    return edge.exit().remove();
  }


  function forceTick() {
    node.attr("transform", (d) => {
      return "translate(" + (d.x - d.radius) + "," + (d.y - d.radius) + ")";
    });
    /*var paddingX = this.getComputedTextLength() / 2;
    var paddingY = 7;    */
    edge.select('text').attr("transform", function(d) {
      var x = d.source.x - d.target.x ;
      var y = d.source.y - d.target.y;
      var angleRadians = Math.atan2(y, x);
      var angle = angleRadians * 180 / Math.PI;

      if (angle > 90 && angle < 180) {
        angle -= 180;
        angleRadians -= Math.PI;
      } else if (angle > -180 && angle < -90) {
        angle += 180;
        angleRadians += Math.PI;
      }

      var padding  = this.getComputedTextLength() / 2;
      var paddingX = (padding + 5) * Math.cos(angleRadians);
      var paddingY = (padding + 5) * Math.sin(angleRadians);


      var translateX = ((d.source.x + d.target.x) / 2) - paddingX;
      var translateY = ((d.source.y + d.target.y) / 2) - paddingY;

      return "translate(" + translateX  + "," + translateY + ")" + 'rotate('+angle+')';
    });
    edge.select('line')
    .attr("x1", d => {
      return d.source.x;
    }).attr("y1", d => {
        return d.source.y;
      }).attr("x2", d => {
        return d.target.x;
      }).attr("y2", d => {
        return d.target.y;
    });

  }

  function createClipRadius(vis : D3.Selection) {
    var defs = vis.append('defs');
    Object.keys(nodes).forEach((i, num) => {
      var d = nodes[i];
      defs.append('clipPath')
      .attr("id", "clipCircle-"+d.id)
      .append('circle')
      .attr('r', d.radius)
      .attr('cx', d.radius )
      .attr('cy', d.radius )
    })

  }

  function setupZoom(root : D3.Selection) {
    zoomed = (data: any , index?: number) : any => {
      console.log('translate', d3.event.translate, 'scale', d3.event.scale)
      root.attr("transform",
        "translate(" + d3.event.translate + ")"
        + " scale(" + d3.event.scale + ")");

    };
    zoomBehavior = d3.behavior.zoom()
      .scaleExtent([.1, 50])
      .on("zoom", zoomed);
    d3.select('#graph').call(zoomBehavior);
  }

  function setupDragging() {

    function dragstarted(d) {
      d3.event.sourceEvent.stopPropagation();
      force.stop();
    }

    function dragged(d) {
      isDragging = true;
      d.px += d3.event.dx;
      d.py += d3.event.dy;
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      forceTick();
    }

    function dragended(d) {
      d3.event.sourceEvent.stopPropagation();
      d.fixed = true;
      forceTick();
      if (isDragging) {
        force.resume();
        isDragging = false;
      }
    }
    drag = d3.behavior.drag()
      .origin((d) => { return d; })
      .on("dragstart", dragstarted)
      .on("drag", dragged)
      .on("dragend", dragended);
  }

  function startWidthData(): void {
    var vis = d3.select(selector).append("svg").attr("width", width).attr("height", height);
    var root = vis.append('g');
    setupData();
    setupZoom(root);
    createClipRadius(vis);

    setupDragging();
    edgesG = root.append("g").attr("id", "links");
    nodesG = root.append("g").attr("id", "nodes");
    force.size([width, height])
      .gravity(0.5)
      .charge(-3900)
      .linkDistance(defaultWidth * 2);

    curNodesData = filterNodes(nodes);
    curEdgesData = filterEdges(edges, curNodesData);
    force.nodes(curNodesData);
    setupNodes();

    force.links(curEdgesData);
    setupEdges();
    force.start();

    force.on("tick", forceTick)
  }

  $(function() {
    init(location.hash.slice(1) || '/');
    start();
  });
};
