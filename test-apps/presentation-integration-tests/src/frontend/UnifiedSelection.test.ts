/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-direct-imports
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { createRandomTransientId, createRandomId } from "@bentley/presentation-common/lib/test/_helpers/random";
import { TRANSIENT_ELEMENT_CLASSNAME } from "@bentley/presentation-frontend/lib/selection/SelectionManager";
import { waitForAllAsyncs } from "@bentley/presentation-common/lib/test/_helpers/PendingAsyncsHelper";
import { ViewportSelectionHandler } from "@bentley/presentation-components/lib/viewport/WithUnifiedSelection";

describe("Unified Selection", () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  describe("Hiliting selection", () => {

    let handler: ViewportSelectionHandler;

    const instances = {
      subject: {
        key: { className: "BisCore:Subject", id: Id64.fromLocalAndBriefcaseIds(1, 0) },
        nestedModelIds: [Id64.fromLocalAndBriefcaseIds(28, 0)],
      },
      model: {
        key: { className: "BisCore:PhysicalModel", id: Id64.fromLocalAndBriefcaseIds(28, 0) },
        nestedModelIds: [], // WIP: no nested models... need a better imodel
      },
      category: {
        key: { className: "BisCore:Category", id: Id64.fromLocalAndBriefcaseIds(23, 0) },
        subCategoryIds: [Id64.fromLocalAndBriefcaseIds(24, 0)],
      },
      subcategory: {
        key: { className: "BisCore:SubCategory", id: Id64.fromLocalAndBriefcaseIds(24, 0) },
      },
      assemblyElement: {
        key: { className: "Generic:PhysicalObject", id: Id64.fromLocalAndBriefcaseIds(117, 0) },
        childElementIds: [], // WIP: no assemblies... need a better imodel
      },
      leafElement: {
        key: { className: "Generic:PhysicalObject", id: Id64.fromLocalAndBriefcaseIds(116, 0) },
      },
      transientElement: {
        key: { className: TRANSIENT_ELEMENT_CLASSNAME, id: createRandomTransientId() },
      },
    };

    beforeEach(() => {
      Presentation.selection.clearSelection("", imodel);
      handler = new ViewportSelectionHandler(imodel);

      // add something to selection set so we can check later
      // if the contents changed
      imodel.selectionSet.add(createRandomId());
    });

    afterEach(() => {
      handler.dispose();
    });

    it("hilites subject", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.subject.key]));
      await waitForAllAsyncs([handler]);
      expect(imodel.hilited.models.size).to.eq(instances.subject.nestedModelIds.length);
      instances.subject.nestedModelIds.forEach((id: Id64String) => expect(imodel.hilited.models.hasId(id)).to.be.true);
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites model", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.model.key]));
      await waitForAllAsyncs([handler]);
      expect(imodel.hilited.models.size).to.eq(1 + instances.model.nestedModelIds.length);
      expect(imodel.hilited.models.hasId(instances.model.key.id)).to.be.true;
      instances.model.nestedModelIds.forEach((id: Id64String) => expect(imodel.hilited.models.hasId(id)).to.be.true);
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites category", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.category.key]));
      await waitForAllAsyncs([handler]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.size).to.eq(instances.category.subCategoryIds.length);
      instances.category.subCategoryIds.forEach((id: Id64String) => expect(imodel.hilited.subcategories.hasId(id)).to.be.true);
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites subcategory", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.subcategory.key]));
      await waitForAllAsyncs([handler]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.size).to.eq(1);
      expect(imodel.hilited.subcategories.hasId(instances.subcategory.key.id)).to.be.true;
      expect(imodel.hilited.elements.isEmpty).to.be.true;
      expect(imodel.selectionSet.size).to.eq(0);
    });

    it("hilites assembly element", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.assemblyElement.key]));
      await waitForAllAsyncs([handler]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1 + instances.assemblyElement.childElementIds.length);
      expect(imodel.hilited.elements.hasId(instances.assemblyElement.key.id)).to.be.true;
      instances.assemblyElement.childElementIds.forEach((id: Id64String) => expect(imodel.hilited.elements.hasId(id)).to.be.true);
      expect(imodel.selectionSet.size).to.eq(1 + instances.assemblyElement.childElementIds.length);
      expect(imodel.selectionSet.has(instances.assemblyElement.key.id)).to.be.true;
      instances.assemblyElement.childElementIds.forEach((id: Id64String) => expect(imodel.selectionSet.has(id)).to.be.true);
    });

    it("hilites leaf element", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.leafElement.key]));
      await waitForAllAsyncs([handler]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1);
      expect(imodel.hilited.elements.hasId(instances.leafElement.key.id)).to.be.true;
      expect(imodel.selectionSet.size).to.eq(1);
      expect(imodel.selectionSet.has(instances.leafElement.key.id)).to.be.true;
    });

    it("hilites transient element", async () => {
      Presentation.selection.addToSelection("", imodel, new KeySet([instances.transientElement.key]));
      await waitForAllAsyncs([handler]);
      expect(imodel.hilited.models.isEmpty).to.be.true;
      expect(imodel.hilited.subcategories.isEmpty).to.be.true;
      expect(imodel.hilited.elements.size).to.eq(1);
      expect(imodel.hilited.elements.hasId(instances.transientElement.key.id)).to.be.true;
      expect(imodel.selectionSet.size).to.eq(1);
      expect(imodel.selectionSet.has(instances.transientElement.key.id)).to.be.true;
    });

  });

});
