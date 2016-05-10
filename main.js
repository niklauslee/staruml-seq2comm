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

    var Repository       = app.getModule("core/Repository"),
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
     * Return a connector connecting between the two given lifelines
     * If no connector, then create one and return.
     *
     * @param {UMLLifeline} lifeline1
     * @param {UMLLifeline} lifeline2
     * @return {UMLConnector}
     */
    function getConnector(lifeline1, lifeline2) {
        var role1 = lifeline1.represent,
            role2 = lifeline2.represent,
            conns = Repository.getRelationshipsOf(role1, function (r) {
                return (r instanceof type.UMLConnector) &&
                    ((r.end1.reference === role1 && r.end2.reference === role2) || (r.end1.reference === role2 && r.end2.reference === role1));
            });

        if (conns.length === 0) {
            var newConn = Factory.createModel("UMLConnector", role1, "ownedElements", {
                modelInitializer: function (m) {
                    m.end1.reference = role1;
                    m.end2.reference = role2;
                }
            });
            return newConn;
        } else {
            return conns[0];
        }
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

        // create connectors if absent
        interaction.messages.forEach(function (m) {
            if (m instanceof type.UMLMessage) {
                if (!m.connector) {
                    var conn = getConnector(m.source, m.target);
                }
            }
        });

        // create lifelines
        interaction.participants.forEach(function (p) {
            if (p instanceof type.UMLLifeline) {
                Factory.createViewOf(p, comm, { editor: DiagramManager.getEditor() });
            }
        });

        // create messages
        interaction.messages.forEach(function (m) {
            if (m instanceof type.UMLMessage) {
                if (!m.connector) {
                    // create connector
                }
            }
        });

        // layout diagram
        // ...
    }

    /**
     * Convert Communication diagram to Sequence diagram
     */
    function convertCommToSeq(comm) {

        var interaction = comm._parent;

        interaction.messages.forEach(function (m) {
            var cons = getConnector(m.source, m.target);
            console.log(m, cons);
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
