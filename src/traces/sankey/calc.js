/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var tarjan = require('strongly-connected-components');
var Lib = require('../../lib');
var wrap = require('../../lib/gup').wrap;

var isArrayOrTypedArray = Lib.isArrayOrTypedArray;
var isIndex = Lib.isIndex;
var Colorscale = require('../../components/colorscale');

function convertToD3Sankey(trace) {
    // var nodeSpec = trace.node;
    // var linkSpec = trace.link;
    var nodeSpec = Lib.extendDeep({}, trace.node);
    var linkSpec = Lib.extendDeep({}, trace.link);

    var links = [];
    var hasLinkColorArray = isArrayOrTypedArray(linkSpec.color);
    var linkedNodes = {};

    var components = {};
    var componentCount = linkSpec.colorscales.length;
    var i;
    for(i = 0; i < componentCount; i++) {
        var cscale = linkSpec.colorscales[i];
        var specs = Colorscale.extractScale(cscale, {cLetter: 'c'});
        var scale = Colorscale.makeColorScaleFunc(specs);
        components[cscale.label] = scale;
    }

    var maxNodeId = 0;
    for(i = 0; i < linkSpec.value.length; i++) {
        if(linkSpec.source[i] > maxNodeId) maxNodeId = linkSpec.source[i];
        if(linkSpec.target[i] > maxNodeId) maxNodeId = linkSpec.target[i];
    }
    var nodeCount = maxNodeId + 1;

    // Group nodes
    var j;
    var groups = trace.node.groups;
    var groupLookup = {};
    for(i = 0; i < groups.length; i++) {
        var group = groups[i];
        // Build a lookup table to quickly find in which group a node is
        if(Array.isArray(group)) {
            for(j = 0; j < group.length; j++) {
                var nodeIndex = group[j];
                var groupIndex = nodeCount + i;
                groupLookup[nodeIndex] = groupIndex;
            }
        } else {
            Lib.warn('node.groups must be an array, default to empty array []');
        }
    }

    // Process links
    for(i = 0; i < linkSpec.value.length; i++) {
        var val = linkSpec.value[i];
        // remove negative values, but keep zeros with special treatment
        var source = linkSpec.source[i];
        var target = linkSpec.target[i];
        if(!(val > 0 && isIndex(source, nodeCount) && isIndex(target, nodeCount))) {
            continue;
        }

        // Remove links that are within the same group
        if(groupLookup.hasOwnProperty(source) && groupLookup.hasOwnProperty(target) && groupLookup[source] === groupLookup[target]) {
            continue;
        }

        // if link targets a node in the group, relink target to that group
        if(groupLookup.hasOwnProperty(target)) {
            target = groupLookup[target];
        }

        // if link originates from a node in a group, relink source to that group
        // if(group.indexOf(source) !== -1) {
        if(groupLookup.hasOwnProperty(source)) {
            source = groupLookup[source];
        }

        source = +source;
        target = +target;
        linkedNodes[source] = linkedNodes[target] = true;

        var label = '';
        if(linkSpec.label && linkSpec.label[i]) label = linkSpec.label[i];

        var concentrationscale = null;
        if(label && components.hasOwnProperty(label)) concentrationscale = components[label];

        links.push({
            pointNumber: i,
            label: label,
            color: hasLinkColorArray ? linkSpec.color[i] : linkSpec.color,
            concentrationscale: concentrationscale,
            source: source,
            target: target,
            value: +val
        });
    }

    // Process nodes
    var totalCount = nodeCount + groups.length;
    var hasNodeColorArray = isArrayOrTypedArray(nodeSpec.color);
    var nodes = [];
    for(i = 0; i < totalCount; i++) {
        if(!linkedNodes[i]) continue;
        var l = nodeSpec.label[i];

        nodes.push({
            group: (i > nodeCount - 1),
            pointNumber: i,
            label: l,
            color: hasNodeColorArray ? nodeSpec.color[i] : nodeSpec.color
        });
    }

    return {
        links: links,
        nodes: nodes,

        // Data structure for groups
        groups: groups,
        groupLookup: groupLookup
    };
}

function circularityPresent(nodeList, sources, targets) {

    var nodeLen = nodeList.length;
    var nodes = Lib.init2dArray(nodeLen, 0);

    for(var i = 0; i < Math.min(sources.length, targets.length); i++) {
        if(Lib.isIndex(sources[i], nodeLen) && Lib.isIndex(targets[i], nodeLen)) {
            if(sources[i] === targets[i]) {
                return true; // self-link which is also a scc of one
            }
            nodes[sources[i]].push(targets[i]);
        }
    }

    var scc = tarjan(nodes);

    // Tarján's strongly connected components algorithm coded by Mikola Lysenko
    // returns at least one non-singular component if there's circularity in the graph
    return scc.components.some(function(c) {
        return c.length > 1;
    });
}

module.exports = function calc(gd, trace) {
    var circular = false;
    if(circularityPresent(trace.node.label, trace.link.source, trace.link.target)) {
        circular = true;
    }

    var result = convertToD3Sankey(trace);

    return wrap({
        circular: circular,
        _nodes: result.nodes,
        _links: result.links,

        // Data structure for grouping
        _groups: result.groups,
        _groupLookup: result.groupLookup,
    });
};
