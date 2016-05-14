/*
 * Copyright (c) 2014 MKLab. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, $, _, window, app, type, appshell, document */

define(function (require, exports, module) {
    "use strict";

    var Core             = app.getModule("core/Core"),
        Repository       = app.getModule("core/Repository"),
        Engine           = app.getModule("engine/Engine"),
        SelectionManager = app.getModule("engine/SelectionManager"),
        Factory          = app.getModule("engine/Factory"),
        Commands         = app.getModule("command/Commands"),
        CommandManager   = app.getModule("command/CommandManager"),
        MenuManager      = app.getModule("menu/MenuManager"),
        Dialogs          = app.getModule("dialogs/Dialogs"),
        DiagramManager   = app.getModule("diagrams/DiagramManager");

    /**
     * Commands IDs
     */
    var CMD_CONVERT_DIAGRAM = 'convertDiagram',
        CMD_SEQ_TO_COMM     = 'convertDiagram.seq2comm',
        CMD_COMM_TO_SEQ     = 'convertDiagram.comm2seq';

    /**
     * Return a connector view connecting between the two given lifeline views.
     * If no connector, then create a connector view and return it.
     *
     * @param {UMLCommunicationDiagram} dgm
     * @param {UMLCommLifelineView} lifelineView1
     * @param {UMLCommLifelineView} lifelineView2
     * @return {UMLConnectorView}
     */
    function getConnectorView(dgm, lifelineView1, lifelineView2) {
        var role1 = lifelineView1.model.represent,
            role2 = lifelineView2.model.represent,
            conns = Repository.getRelationshipsOf(role1, function (r) {
                return (r instanceof type.UMLConnector) &&
                    ((r.end1.reference === role1 && r.end2.reference === role2) || (r.end1.reference === role2 && r.end2.reference === role1));
            });

        var connView = null;
        if (conns.length === 0) {
            connView = Factory.createModelAndView("UMLConnector", role1, dgm, {
                x1: lifelineView1.left,
                y1: lifelineView1.top,
                x2: lifelineView2.left,
                y2: lifelineView2.top,
                tailView: lifelineView1,
                headView: lifelineView2,
                tailModel: lifelineView1.model,
                headModel: lifelineView2.model
            });
            return connView;
        } else {
            connView = _.find(dgm.ownedViews, function (v) { return v.model === conns[0]; });
            if (!connView) {
                return Factory.createViewOf(conns[0], dgm);
            }
            return connView;
        }
    }

    /**
     * Return a lifeline view of a given lifeline contained in the diagram
     *
     * @param {UMLLifeline} lifeline1
     * @param {UMLLifeline} lifeline2
     * @return {UMLConnector}
     */
    function getLifelineView(diagram, lifeline) {
        var i, len, view;
        if (diagram instanceof type.UMLSequenceDiagram) {
            for (i = 0, len = diagram.ownedViews.length; i < len; i++) {
                view = diagram.ownedViews[i];
                if (view instanceof type.UMLSeqLifelineView && view.model === lifeline) {
                    return view;
                }
            }
        } else if (diagram instanceof type.UMLCommunicationDiagram) {
            for (i = 0, len = diagram.ownedViews.length; i < len; i++) {
                view = diagram.ownedViews[i];
                if (view instanceof type.UMLCommLifelineView && view.model === lifeline) {
                    return view;
                }
            }
        }
        return null;
    }

    /**
     * Convert Sequence diagram to Communication diagram
     */
    function convertSeqToComm(seq) {
        // create a communication diagram
        var interaction = seq._parent,
            comm = Factory.createDiagram("UMLCommunicationDiagram", interaction, {
            diagramInitializer: function (d) {
                d.name = seq.name;
            }
        });
        comm = Repository.get(comm._id);

        // delete frame
        var frame = _.find(comm.ownedViews, function (v) {
            return (v instanceof type.UMLFrameView);
        });
        if (frame) {
            Engine.deleteElements([], [frame]);
        }

        // create lifelines
        interaction.participants.forEach(function (p, idx) {
            if (p instanceof type.UMLLifeline) {
                Factory.createViewOf(p, comm, {
                    editor: DiagramManager.getEditor(),
                    x: (idx * 100) + 30,
                    y: 30
                });
            }
        });

        // create messages
        interaction.messages.forEach(function (m) {
            if (m instanceof type.UMLMessage) {
                if (m.source instanceof type.UMLLifeline && m.target instanceof type.UMLLifeline) {
                    var lv1 = getLifelineView(comm, m.source),
                        lv2 = getLifelineView(comm, m.target),
                        cnv = getConnectorView(comm, lv1, lv2);
                    Engine.setProperty(m, "connector", cnv.model);
                    var parasitics = _.filter(comm.ownedViews, function (v) {
                        return (v.hostEdge === cnv);
                    });
                    var mv = Factory.createViewOf(m, comm);
                    mv = Repository.get(mv._id);
                    Engine.setProperty(mv, "distance", (20 * parasitics.length) + 10);
                }
            }
        });

        // layout diagram
        Engine.layoutDiagram(DiagramManager.getEditor(), comm, Core.DIRECTION_LR, { node: 100, edge: 100, rank: 100 }, Core.LS_OBLIQUE);
        var bound = comm.getBoundingBox(),
            dx    = (bound.x1 - 30) * -1,
            dy    = (bound.y1 - 30) * -1;
        Engine.moveViews(DiagramManager.getEditor(), comm.ownedViews, dx, dy);

        // create frame
        var newBound = comm.getBoundingBox();
        Factory.createModelAndView("UMLFrame", null, comm, {
            viewInitializer: function (v) {
                v.model = comm;
                v.left = 10;
                v.top = 10;
                v.width = (newBound.x2 - newBound.x1) + 40;
                v.height = (newBound.y2 - newBound.y1) + 40;
            }
        });

    }

    /**
     * Convert Communication diagram to Sequence diagram
     */
    function convertCommToSeq(comm) {
        // create a sequence diagram
        var interaction = comm._parent,
            seq = Factory.createDiagram("UMLSequenceDiagram", interaction, {
            diagramInitializer: function (d) {
                d.name = comm.name;
            }
        });
        seq = Repository.get(seq._id);

        // delete frame
        var frame = _.find(seq.ownedViews, function (v) {
            return (v instanceof type.UMLFrameView);
        });
        if (frame) {
            Engine.deleteElements([], [frame]);
        }

        // create lifelines
        var _h = (interaction.messages.length * 35) + 70,
            _x = 30;
        interaction.participants.forEach(function (p, idx) {
            if (p instanceof type.UMLLifeline) {
                var v = Factory.createViewOf(p, seq, {
                    editor: DiagramManager.getEditor(),
                    viewInitializer: function (lv) {
                        lv.left = _x;
                        lv.height = _h;
                    }
                });
                _x = v.getRight() + 20;
            }
        });

        // create messages
        var _y = 100;
        interaction.messages.forEach(function (m) {
            if (m instanceof type.UMLMessage) {
                if (m.source instanceof type.UMLLifeline && m.target instanceof type.UMLLifeline) {
                    var mv = Factory.createViewOf(m, seq, {
                        editor: DiagramManager.getEditor(),
                        y: _y
                    });
                    _y = _y + 35;
                }
            }
        });

        // create frame
        var newBound = seq.getBoundingBox();
        Factory.createModelAndView("UMLFrame", null, seq, {
            viewInitializer: function (v) {
                v.model = seq;
                v.left = 10;
                v.top = 10;
                v.width = newBound.x2 + 10;
                v.height = newBound.y2 + 10;
            }
        });
    }

    /**
     * Handle for Seq2Comm Command
     */
    function _handleSeqToComm() {
        // Select active or selected sequence diagram
        var dgm = DiagramManager.getCurrentDiagram();
        if (!(dgm instanceof type.UMLSequenceDiagram)) {
            dgm = SelectionManager.getSelected();
        }
        if (dgm instanceof type.UMLSequenceDiagram) {
            Dialogs.showConfirmDialog(
                "Create a Communication Diagram converted from '" + dgm.name + "'?"
            ).done(function (buttonId) {
                if (buttonId === Dialogs.DIALOG_BTN_OK) {
                    convertSeqToComm(dgm);
                }
            });
        } else {
            Dialogs.showInfoDialog("Activate or select a Sequence Diagram.");
        }
    }

    /**
     * Handle for Comm2Seq Command
     */
    function _handleCommToSeq() {
        // Select active or selected sequence diagram
        var dgm = DiagramManager.getCurrentDiagram();
        if (!(dgm instanceof type.UMLCommunicationDiagram)) {
            dgm = SelectionManager.getSelected();
        }
        if (dgm instanceof type.UMLCommunicationDiagram) {
            Dialogs.showConfirmDialog(
                "Create a Sequence Diagram converted from '" + dgm.name + "'?"
            ).done(function (buttonId) {
                if (buttonId === Dialogs.DIALOG_BTN_OK) {
                    convertCommToSeq(dgm);
                }
            });
        } else {
            Dialogs.showInfoDialog("Activate or select a Communication Diagram.");
        }
    }

    // Register Commands
    CommandManager.register("Convert Diagram",           CMD_CONVERT_DIAGRAM, CommandManager.doNothing);
    CommandManager.register("Sequence to Communication", CMD_SEQ_TO_COMM,     _handleSeqToComm);
    CommandManager.register("Communication to Sequence", CMD_COMM_TO_SEQ,     _handleCommToSeq);

    var menu, menuItem;
    menu = MenuManager.getMenu(Commands.TOOLS);
    menuItem = menu.addMenuItem(CMD_CONVERT_DIAGRAM);
    menuItem.addMenuItem(CMD_SEQ_TO_COMM);
    menuItem.addMenuItem(CMD_COMM_TO_SEQ);

});
