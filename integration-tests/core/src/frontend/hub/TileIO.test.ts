/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SurfaceType } from "@bentley/imodeljs-frontend/lib/rendering";
import { Batch, MeshGraphic, GraphicsArray, Primitive, PolylineGeometry, RenderOrder } from "@bentley/imodeljs-frontend/lib/webgl";
import {
  BatchType,
  CloudStorageTileCache,
  CurrentImdlVersion,
  ImdlFlags,
  ImdlHeader,
  IModelTileTreeId,
  iModelTileTreeIdToString,
  ModelProps,
  RelatedElementProps,
  ServerTimeoutError,
  TileContentIdentifier,
  TileFormat,
  TileReadStatus,
} from "@bentley/imodeljs-common";
import { ByteStream, Id64, Id64String } from "@bentley/bentleyjs-core";
import * as path from "path";
import {
  GeometricModelState,
  ImdlReader,
  IModelApp,
  IModelConnection,
  IModelTileLoader,
  MockRender,
  RenderGraphic,
  TileAdmin,
  TileRequest,
  TileTree,
  ViewState,
} from "@bentley/imodeljs-frontend";
import { TileTestCase, TileTestData } from "./TileIO.data";
import { TILE_DATA_1_1 } from "./TileIO.data.1.1";
import { TILE_DATA_1_2 } from "./TileIO.data.1.2";
import { TILE_DATA_1_3 } from "./TileIO.data.1.3";
import { TILE_DATA_1_4 } from "./TileIO.data.1.4";
import { TILE_DATA_2_0 } from "./TileIO.data.2.0";
import { changeMinorVersion, changeMajorVersion, changeHeaderLength } from "./TileIO.data.fake";
import { testOnScreenViewport } from "../TestViewport";

const iModelLocation = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");

const testCases = [
  TILE_DATA_1_1,
  TILE_DATA_1_2,
  TILE_DATA_1_3,
  TILE_DATA_1_4,
  TILE_DATA_2_0,
];

const currentTestCase = testCases[testCases.length - 1];

// Make fake versions of each real version
const numBaseTestCases = testCases.length;
for (let i = 0; i < numBaseTestCases; i++) {
  const testCase = testCases[i];
  testCases.push(changeMinorVersion(testCase, 5000 + i));
  testCases.push(changeMajorVersion(testCase, 6000 + i));
  testCases.push(changeHeaderLength(testCase, 7000 + i, 8));
}

export class FakeGMState extends GeometricModelState {
  public get is3d(): boolean { return true; }
  public get is2d(): boolean { return !this.is3d; }
  public constructor(props: ModelProps, iModel: IModelConnection) { super(props, iModel); }
}

export class FakeModelProps implements ModelProps {
  public modeledElement: RelatedElementProps;
  public classFullName: string = "fake";
  public constructor(props: RelatedElementProps) { this.modeledElement = props; }
}

export class FakeREProps implements RelatedElementProps {
  public id: Id64String;
  public constructor() { this.id = Id64.invalid; }
}

function delta(a: number, b: number): number { return Math.abs(a - b); }
type ProcessGraphic = (graphic: RenderGraphic) => void;

function processHeader(data: TileTestData, test: TileTestCase, numElements: number) {
  const stream = new ByteStream(test.bytes.buffer);
  stream.reset();
  const header = new ImdlHeader(stream);
  expect(header.isValid).to.be.true;
  expect(header.format).to.equal(TileFormat.IModel);
  expect(header.versionMajor).to.equal(data.versionMajor);
  expect(header.versionMinor).to.equal(data.versionMinor);
  expect(header.headerLength).to.equal(data.headerLength);
  expect(header.tileLength).to.equal(test.bytes.byteLength);
  expect(header.flags).to.equal(test.flags);
  expect(header.numElementsIncluded).to.equal(numElements);
  expect(header.numElementsExcluded).to.equal(0);
  expect(header.isReadableVersion).to.equal(!data.unreadable);
}

function createReader(imodel: IModelConnection, data: TileTestData, test: TileTestCase): ImdlReader | undefined {
  const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
  const stream = new ByteStream(test.bytes.buffer);
  const reader = ImdlReader.create(stream, imodel, model.id, model.is3d, IModelApp.renderSystem);
  expect(undefined === reader).to.equal(!!data.unreadable);
  return reader;
}

async function processRectangle(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.rectangle, 1);
  const reader = createReader(imodel, data, data.rectangle);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -2.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -5.0)).to.be.lessThan(0.0005);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 2.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 5.0)).to.be.lessThan(0.0005);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachRectangle(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processRectangle(data, imodel, processGraphic);
}

async function processTriangles(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.triangles, 6);
  const reader = createReader(imodel, data, data.triangles);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -10.0)).to.be.lessThan(0.00051);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 10.0)).to.be.lessThan(0.00051);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachTriangles(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processTriangles(data, imodel, processGraphic);
}

async function processLineString(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.lineString, 1);
  const reader = createReader(imodel, data, data.lineString);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -10.0)).to.be.lessThan(0.00051);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 10.0)).to.be.lessThan(0.00051);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachLineString(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processLineString(data, imodel, processGraphic);
}

async function processLineStrings(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.lineStrings, 3);
  const reader = createReader(imodel, data, data.lineStrings);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileReadStatus.Success);
    expect(result.isLeaf).to.be.true;
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -7.5)).to.be.lessThan(0.0005);
    expect(delta(low.y, -30.0)).to.be.lessThan(0.0016);
    expect(delta(low.z, 0.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 7.5)).to.be.lessThan(0.0005);
    expect(delta(high.y, 30.0)).to.be.lessThan(0.0016);
    expect(delta(high.z, 0.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachLineStrings(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processLineStrings(data, imodel, processGraphic);
}

async function processCylinder(data: TileTestData, imodel: IModelConnection, processGraphic: ProcessGraphic) {
  processHeader(data, data.cylinder, 1);
  const reader = createReader(imodel, data, data.cylinder);
  if (undefined !== reader) {
    const result = await reader.read();
    expect(result.readStatus).to.equal(TileReadStatus.Success);
    expect(result.isLeaf).to.be.false; // cylinder contains curves - not a leaf - can be refined to higher-resolution single child.
    expect(result.contentRange).not.to.be.undefined;

    // Confirm content range. Positions in the tile are transformed such that the origin is at the tile center.
    const low = result.contentRange!.low;
    expect(delta(low.x, -2.0)).to.be.lessThan(0.0005);
    expect(delta(low.y, -2.0)).to.be.lessThan(0.0005);
    expect(delta(low.z, -3.0)).to.be.lessThan(0.0005);

    const high = result.contentRange!.high;
    expect(delta(high.x, 2.0)).to.be.lessThan(0.0005);
    expect(delta(high.y, 2.0)).to.be.lessThan(0.0005);
    expect(delta(high.z, 3.0)).to.be.lessThan(0.0005);

    expect(result.graphic).not.to.be.undefined;
    processGraphic(result.graphic!);
  }
}

async function processEachCylinder(imodel: IModelConnection, processGraphic: ProcessGraphic) {
  for (const data of testCases)
    await processCylinder(data, imodel, processGraphic);
}

// These tests require the real (webgl-based) RenderSystem.
describe("TileIO (WebGL)", () => {
  let imodel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    imodel = await IModelConnection.openSnapshot(iModelLocation);
  });

  after(async () => {
    if (imodel) await imodel.closeSnapshot();
    IModelApp.shutdown();
  });

  it("should read an iModel tile containing a single rectangle", async () => {
    if (IModelApp.initialized) {
      await processEachRectangle(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(MeshGraphic);
        const mg = batch.graphic as MeshGraphic;
        expect(mg.surfaceType).to.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.true;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(4);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.false;
      });
    }
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", async () => {
    if (IModelApp.initialized) {
      await processEachTriangles(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.false;
        expect(batch.featureTable.numFeatures).to.equal(6);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsArray);
        const list = batch.graphic as GraphicsArray;
        expect(list.graphics.length).to.equal(2);

        expect(list.graphics[0]).to.be.instanceOf(MeshGraphic);
        let mg = list.graphics[0] as MeshGraphic;
        expect(mg.surfaceType).to.be.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.true;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(9);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.false;

        expect(list.graphics[1]).to.be.instanceOf(MeshGraphic);
        mg = list.graphics[1] as MeshGraphic;
        expect(mg.surfaceType).to.be.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.true;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(9);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.true;
      });
    }
  });

  it("should read an iModel tile containing single open yellow line string", async () => {
    if (IModelApp.initialized) {
      await processEachLineString(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.featureTable.numFeatures).to.equal(1);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(Primitive);
        const plinePrim = batch.graphic as Primitive;
        expect(plinePrim.hasFeatures).to.be.true;
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(RenderOrder.Linear);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        const plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(114); // previously was 60 - but now polyline is tesselated.
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.lineCode).to.equal(0);
        expect(plGeom.lineWeight).to.equal(9);
        expect(plGeom.isPlanar).to.be.false;
      });
    }
  });

  it("should read an iModel tile containing multiple line strings", async () => {
    if (IModelApp.initialized) {
      await processEachLineStrings(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.false;
        expect(batch.featureTable.numFeatures).to.equal(3);
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(GraphicsArray);
        const list = batch.graphic as GraphicsArray;
        expect(list.graphics.length).to.equal(2);

        expect(list.graphics[0]).to.be.instanceOf(Primitive);
        let plinePrim = list.graphics[0] as Primitive;
        expect(plinePrim.hasFeatures).to.be.true;
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(RenderOrder.Linear);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        let plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(114); // previously was 60 - but now polyline is tesselated.
        expect(plGeom.lut.numVertices).to.equal(6);
        expect(plGeom.lineCode).to.equal(0);
        expect(plGeom.lineWeight).to.equal(9);
        expect(plGeom.isPlanar).to.be.false;

        expect(list.graphics[1]).to.be.instanceOf(Primitive);
        plinePrim = list.graphics[1] as Primitive;
        expect(plinePrim.hasFeatures).to.be.true;
        expect(plinePrim.isEdge).to.be.false;
        expect(plinePrim.isLit).to.be.false;
        expect(plinePrim.renderOrder).to.equal(RenderOrder.Linear);
        expect(plinePrim.cachedGeometry).to.not.be.undefined;
        plGeom = plinePrim.cachedGeometry as PolylineGeometry;
        expect(plGeom.numIndices).to.equal(228); // 120 pre-tesselation...
        expect(plGeom.lut.numVertices).to.equal(12);
        expect(plGeom.lineCode).to.equal(2);
        expect(plGeom.lineWeight).to.equal(9);
        expect(plGeom.isPlanar).to.be.false;
      });
    }
  });

  it("should read an iModel tile containing edges and silhouettes", async () => {
    if (IModelApp.initialized) {
      await processEachCylinder(imodel, (graphic) => {
        expect(graphic).to.be.instanceOf(Batch);
        const batch = graphic as Batch;
        expect(batch.featureTable.isUniform).to.be.true;
        expect(batch.graphic).not.to.be.undefined;
        expect(batch.graphic).to.be.instanceOf(MeshGraphic);
        const mg = batch.graphic as MeshGraphic;
        expect(mg.surfaceType).to.equal(SurfaceType.Lit);
        expect(mg.meshData).not.to.be.undefined;
        expect(mg.meshData.edgeLineCode).to.equal(0);
        expect(mg.meshData.edgeWidth).to.equal(1);
        expect(mg.meshData.isPlanar).to.be.false;
        expect(mg.meshData.lut.numRgbaPerVertex).to.equal(4);
        expect(mg.meshData.lut.numVertices).to.equal(146);
        expect(mg.meshData.lut.colorInfo.isUniform).to.be.true;
        expect(mg.meshData.lut.colorInfo.isNonUniform).to.be.false;
        expect(mg.meshData.lut.colorInfo.hasTranslucency).to.be.false;
      });
    }
  });
});

// These tests use the mock RenderSystem (do not require WebGL) so will execute in Windows CI job.
describe("TileIO (mock render)", () => {
  let imodel: IModelConnection;

  before(async () => {
    MockRender.App.startup();
    imodel = await IModelConnection.openSnapshot(iModelLocation);
  });

  after(async () => {
    if (imodel) await imodel.closeSnapshot();
    MockRender.App.shutdown();
  });

  it("should support canceling operation", async () => {
    if (IModelApp.initialized) {
      const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel);
      const stream = new ByteStream(currentTestCase.rectangle.bytes.buffer);
      const reader = ImdlReader.create(stream, model.iModel, model.id, model.is3d, IModelApp.renderSystem, BatchType.Primary, true, (_) => true);
      expect(reader).not.to.be.undefined;

      const result = await reader!.read();
      expect(result.readStatus).to.equal(TileReadStatus.Canceled);
    }
  });

  it("should obtain tiles from backend", async () => {
    // This data set contains 4 physical models: 0x1c (empty), 0x22, 0x23, and 0x24. The latter 3 collectively contain 4 spheres.
    const modelProps = await imodel.models.getProps("0x22");
    expect(modelProps.length).to.equal(1);

    const tree = await imodel.tiles.getTileTreeProps(modelProps[0].id!.toString());

    expect(tree.id).to.equal(modelProps[0].id);
    expect(tree.maxTilesToSkip).to.equal(1);
    expect(tree.rootTile).not.to.be.undefined;

    const rootTile = tree.rootTile;
    expect(rootTile.contentId).to.equal("0/0/0/0/1");
    expect(rootTile.isLeaf).to.be.false; // this tile has one higher-resolution child because it contains only 1 elements (a sphere)
  });

  it("should read an iModel tile containing a single rectangle", async () => {
    await processEachRectangle(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).instanceof(MockRender.Graphic);
    });
  });

  it("should read an iModel tile containing multiple meshes and non-uniform feature/color tables", async () => {
    await processEachTriangles(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.false;
      expect(batch.featureTable.numFeatures).to.equal(6);
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).instanceof(MockRender.List);
      const list = batch.graphic as MockRender.List;
      expect(list.graphics.length).to.equal(2);
    });
  });

  it("should read an iModel tile containing single open yellow line string", async () => {
    await processEachLineString(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.featureTable.numFeatures).to.equal(1);
      expect(batch.graphic).not.to.be.undefined;
    });
  });

  it("should read an iModel tile containing multiple line strings", async () => {
    await processEachLineStrings(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.false;
      expect(batch.featureTable.numFeatures).to.equal(3);
      expect(batch.graphic).not.to.be.undefined;
      expect(batch.graphic).to.be.instanceOf(MockRender.List);
      const list = batch.graphic as MockRender.List;
      expect(list.graphics.length).to.equal(2);
    });
  });

  it("should read an iModel tile containing edges and silhouettes", async () => {
    await processEachCylinder(imodel, (graphic) => {
      expect(graphic).instanceof(MockRender.Batch);
      const batch = graphic as MockRender.Batch;
      expect(batch.featureTable.isUniform).to.be.true;
      expect(batch.graphic).not.to.be.undefined;
    });
  });
});

async function waitUntil(condition: () => boolean): Promise<void> {
  if (condition())
    return Promise.resolve();

  await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
  return waitUntil(condition);
}

async function getGeometricModel(imodel: IModelConnection, modelId: Id64String): Promise<GeometricModelState> {
  await imodel.models.load(modelId)!;
  const baseModel = imodel.models.getLoaded(modelId)!;
  expect(baseModel).not.to.be.undefined;
  const model = baseModel.asGeometricModel!;
  expect(model).not.to.be.undefined;
  return model;
}

async function getTileTree(imodel: IModelConnection, modelId: Id64String, edgesRequired = true, animationId?: Id64String): Promise<TileTree> {
  const model = await getGeometricModel(imodel, modelId);
  return getPrimaryTileTree(model, edgesRequired, animationId);
}

async function getPrimaryTileTree(model: GeometricModelState, edgesRequired = true, animationId?: Id64String): Promise<TileTree> {
  // tile tree reference wants a ViewState so it can check viewFlags.edgesRequired() and scheduleScript.getModelAnimationId(modelId) and for access to its IModelConnection.
  // ###TODO Make that an interface instead of requiring a ViewState.
  let scheduleScript;
  if (undefined !== animationId)
    scheduleScript = { getModelAnimationId: () => animationId };

  const fakeViewState = {
    iModel: model.iModel,
    scheduleScript,
    viewFlags: {
      edgesRequired: () => edgesRequired,
    },
  };

  const ref = model.createTileTreeReference(fakeViewState as ViewState);
  const owner = ref.treeOwner;
  owner.load();
  await waitUntil(() => {
    return TileTree.LoadStatus.Loaded === owner.loadStatus;
  });

  const tree = owner.tileTree;
  expect(tree).not.to.be.undefined;
  return tree!;
}

describe("mirukuru TileTree", () => {
  let imodel: IModelConnection;

  class TestTarget extends MockRender.OnScreenTarget {
    public setRenderToScreen(toScreen: boolean): HTMLCanvasElement | undefined {
      return toScreen ? document.createElement("canvas") : undefined;
    }
  }

  class TestSystem extends MockRender.System {
    public createTarget(canvas: HTMLCanvasElement): TestTarget { return new TestTarget(this, canvas); }
  }

  before(async () => {
    MockRender.App.systemFactory = () => new TestSystem();
    MockRender.App.startup();
    imodel = await IModelConnection.openSnapshot(path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/mirukuru.ibim"));
  });

  afterEach(() => {
    if (imodel) {
      // Ensure tiles are not in memory...
      // NB: purge() does not suffice - we have to discard the suppliers and their TreeOwners too, because geometryGuid.
      // NB: dispose() is not right either - that permanently sets a flag that TileRequests check to determine if they should be cancelled.
      // reset() is like dispose() except it does not set that flag.
      imodel.tiles.reset();

      // Reset statistics...
      IModelApp.tileAdmin.resetStatistics();
    }
  });

  after(async () => {
    if (imodel) await imodel.closeSnapshot();
    MockRender.App.shutdown();
  });

  // mirukuru contains a model (ID 0x1C) containing a single rectangle.
  // confirm we can obtain and deserialize contents of that tile, and that it is a leaf tile.
  it("should obtain a single leaf tile", async () => {
    const modelProps = await imodel.models.getProps("0x1c");
    expect(modelProps.length).to.equal(1);

    const treeProps = await imodel.tiles.getTileTreeProps(modelProps[0].id!);
    expect(treeProps.id).to.equal(modelProps[0].id);
    expect(treeProps.rootTile).not.to.be.undefined;

    const rootTile = treeProps.rootTile;
    expect(rootTile.isLeaf).not.to.be.true; // the backend will only set this to true if the tile range contains no elements.

    const loader = new IModelTileLoader(imodel, treeProps.formatVersion, BatchType.Primary, true, true, undefined);
    const tree = new TileTree(TileTree.paramsFromJSON(treeProps, imodel, true, loader, "0x1c"));

    const response: TileRequest.Response = await loader.requestTileContent(tree.rootTile, () => false);
    expect(response).not.to.be.undefined;
    expect(response).instanceof(Uint8Array);

    const isCanceled = () => false; // Our tile has no Request, therefore not considered in "loading" state, so would be immediately treated as "canceled" during loading...
    const gfx = await loader.loadTileContent(tree.rootTile, response as Uint8Array, isCanceled);
    expect(gfx).not.to.be.undefined;
    expect(gfx.graphic).not.to.be.undefined;
    expect(gfx.isLeaf).to.be.true;
    expect(gfx.contentRange).not.to.be.undefined;
    expect(gfx.contentRange!.isNull).to.be.false;

    const projExt = imodel.projectExtents;
    expect(projExt.maxLength()).to.equal(gfx.contentRange!.maxLength());
  });

  it("should load model's tile tree asynchronously", async () => {
    const tree = getTileTree(imodel, "0x1c")!;
    expect(tree).not.to.be.undefined;
  });

  it("should have expected metadata for root tile", async () => {
    const test = async (tree: TileTree, expectedVersion: number, expectedRootContentId: string) => {
      expect(tree).not.to.be.undefined;
      expect(tree.rootTile.contentId).to.equal(expectedRootContentId);
      const response = await tree.loader.requestTileContent(tree.rootTile, () => false);
      expect(response).instanceof(Uint8Array);

      // The model contains a single rectangular element.
      const stream = new ByteStream((response as Uint8Array).buffer);
      const header = new ImdlHeader(stream);
      expect(header.isValid).to.be.true;
      expect(header.format).to.equal(TileFormat.IModel);
      expect(header.version).to.equal(expectedVersion);
      expect(header.versionMajor).to.equal(expectedVersion >> 0x10);
      expect(header.versionMinor).to.equal(expectedVersion & 0xffff);
      expect(header.flags).to.equal(ImdlFlags.None);
      expect(header.numElementsIncluded).to.equal(1);
      expect(header.numElementsExcluded).to.equal(0);

      const projExt = imodel.projectExtents;
      expect(projExt.xLength()).to.equal(header.contentRange.xLength());
      expect(projExt.yLength()).to.equal(header.contentRange.yLength());
      expect(header.contentRange.zLength()).to.equal(0); // project extents are chubbed up; content range is tight.
    };

    // Test current version of tile tree by asking model to load it
    const modelTree = await getTileTree(imodel, "0x1c");
    await test(modelTree, CurrentImdlVersion.Combined, "-1-0-0-0-0-1");

    // Test directly loading a tile tree of version 3.0
    const v3Props = await imodel.tiles.getTileTreeProps("0x1c");
    expect(v3Props).not.to.be.undefined;
    const loader = new IModelTileLoader(imodel, v3Props.formatVersion, BatchType.Primary, false, false, undefined);
    v3Props.rootTile.contentId = loader.rootContentId;
    const v3Tree = new TileTree(TileTree.paramsFromJSON(v3Props, imodel, true, loader, "0x1c"));
    await test(v3Tree, 0x00030000, "_3_0_0_0_0_0_1");
  });

  it("should retry tile requests on server timeout error", async () => {
    let treeCounter = 0;
    let tileCounter = 0;
    const numRetries = 3;

    const getTileTreeProps = imodel.tiles.getTileTreeProps;
    imodel.tiles.getTileTreeProps = async () => {
      ++treeCounter;
      if (treeCounter >= numRetries)
        imodel.tiles.getTileTreeProps = getTileTreeProps;

      throw new ServerTimeoutError("fake timeout");
    };

    const getTileContent = imodel.tiles.getTileContent;
    imodel.tiles.getTileContent = async () => {
      ++tileCounter;
      if (tileCounter >= numRetries)
        imodel.tiles.getTileContent = getTileContent;

      throw new ServerTimeoutError("fake timeout");
    };

    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      await vp.waitForAllTilesToRender();
      expect(tileCounter).to.equal(numRetries);
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);
      expect(treeCounter).to.equal(numRetries);
    });
  });

  it("should retry tile requests if canceled while awaiting cache miss", async () => {
    let tileCounter = 0;
    const numRetries = 3;

    // Replace the `isCanceled` property with one that returns true `numRetries` times, to indicate the request should not be forwarded to the backend in the event of a cache miss.
    // (Because we are running locally, we will never get a cache hit).
    const propertyDescriptor = Object.getOwnPropertyDescriptor(TileRequest.prototype, "isCanceled")!;
    const oldGet = propertyDescriptor.get;
    propertyDescriptor.get = () => {
      ++tileCounter;
      if (tileCounter >= numRetries) {
        propertyDescriptor.get = oldGet;
        Object.defineProperty(TileRequest.prototype, "isCanceled", propertyDescriptor);
      }

      return true;
    };
    Object.defineProperty(TileRequest.prototype, "isCanceled", propertyDescriptor);

    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      await vp.waitForAllTilesToRender();
      expect(tileCounter).to.equal(numRetries);
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      const stats = IModelApp.tileAdmin.statistics;
      // We only record cache misses if the request is NOT canceled.
      expect(stats.totalCacheMisses).to.equal(1);
      expect(stats.totalDispatchedRequests).to.equal(numRetries + 1);
    });
  });

  it("should use a different tile tree when view flags change", async () => {
    const modelId = "0x1c";
    await imodel.models.load(modelId);
    const model = imodel.models.getLoaded(modelId) as GeometricModelState;

    let edgesRequired = false;
    const viewState = {
      iModel: imodel,
      viewFlags: { edgesRequired: () => edgesRequired },
    };

    const treeRef = model.createTileTreeReference(viewState as ViewState);
    const noEdges = treeRef.treeOwner;

    edgesRequired = true;
    const edges = treeRef.treeOwner;
    expect(edges).not.to.equal(noEdges);

    const edges2 = treeRef.treeOwner;
    expect(edges2).to.equal(edges);

    edgesRequired = false;
    const noEdges2 = treeRef.treeOwner;
    expect(noEdges2).to.equal(noEdges);
  });

  it("should preserve model's geometryGuid as cache key", async () => {
    const model = await getGeometricModel(imodel, "0x1c");
    expect(model.geometryGuid).to.be.undefined;
    let tree = await getPrimaryTileTree(model, true);
    let loader = tree.loader as IModelTileLoader;

    const getGuid = () => (loader as any)._guid;
    expect(getGuid()).to.be.undefined;

    model.geometryGuid = "abcdef";
    tree = await getPrimaryTileTree(model, false);
    loader = tree.loader as IModelTileLoader;
    expect(getGuid()).not.to.be.undefined;
    expect(getGuid()).to.equal("abcdef");

    model.geometryGuid = undefined;
  });

  it("should use correct URL for tile cache", async () => {
    const model = await getGeometricModel(imodel, "0x1c");
    model.geometryGuid = undefined;
    const expectContentId = async (expected: string, edgesRequired: boolean) => {
      let contentId: string | undefined;
      const cache = CloudStorageTileCache.getCache();
      const retrieveImpl = cache.retrieve;
      cache.retrieve = async (id: TileContentIdentifier) => {
        contentId = cache.formResourceName(id);
        cache.retrieve = retrieveImpl;
        return cache.retrieve(id);
      };

      const tree = await getPrimaryTileTree(model, edgesRequired);
      await tree.loader.requestTileContent(tree.rootTile, () => false);
      expect(contentId).not.to.be.undefined;
      expect(contentId!.includes(expected)).to.be.true;
    };

    await expectContentId("first", false);
    model.geometryGuid = "abcdef";
    await expectContentId("abcdef", true);
    model.geometryGuid = undefined;
  });
});

describe("TileAdmin", () => {
  let theIModel: IModelConnection | undefined;

  after(async () => {
    if (theIModel) {
      await theIModel.closeSnapshot();
      theIModel = undefined;
    }

    if (IModelApp.initialized)
      IModelApp.shutdown();
  });

  class TileAdminApp extends MockRender.App {
    public static async start(props: TileAdmin.Props): Promise<IModelConnection> {
      super.startup({
        tileAdmin: TileAdmin.create(props),
      });

      theIModel = await IModelConnection.openSnapshot(path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/mirukuru.ibim"));
      return theIModel;
    }

    public static async restart(props: TileAdmin.Props): Promise<IModelConnection> {
      await this.stop();
      return this.start(props);
    }

    public static async stop() {
      if (undefined !== theIModel) {
        await theIModel.closeSnapshot();
        theIModel = undefined;
      }

      IModelApp.shutdown();
    }
  }

  it("should omit or load edges based on configuration and view flags", async () => {
    class App extends TileAdminApp {
      private static async testPrimaryTree(imodel: IModelConnection, expectedTreeIdStr: string, animationId?: Id64String) {
        // Test without edges
        const requestWithoutEdges = true;
        let expectedTreeIdStrNoEdges = expectedTreeIdStr;
        if (requestWithoutEdges) {
          // "0xabc" => E:0_0xabc"
          // "A:0x123_0xabc" => "A:0x123_E:0_0xabc"
          const lastIndex = expectedTreeIdStr.lastIndexOf("0x");
          expectedTreeIdStrNoEdges = expectedTreeIdStr.substring(0, lastIndex) + "E:0_" + expectedTreeIdStr.substring(lastIndex);
        }

        const treeId: IModelTileTreeId = { type: BatchType.Primary, edgesRequired: false, animationId };
        let actualTreeIdStr = iModelTileTreeIdToString("0x1c", treeId, IModelApp.tileAdmin);
        expect(actualTreeIdStr).to.equal(expectedTreeIdStrNoEdges);

        const treePropsNoEdges = await imodel.tiles.getTileTreeProps(actualTreeIdStr);
        expect(treePropsNoEdges.id).to.equal(actualTreeIdStr);

        const treeNoEdges = await getTileTree(imodel, "0x1c", false, animationId);
        expect(treeNoEdges.id).to.equal(actualTreeIdStr);

        const treeNoEdges2 = await getTileTree(imodel, "0x1c", false, animationId);
        expect(treeNoEdges2).to.equal(treeNoEdges);

        expect(await this.rootTileHasEdges(treeNoEdges, imodel)).to.equal(!requestWithoutEdges);

        // Test with edges
        treeId.edgesRequired = true;
        actualTreeIdStr = iModelTileTreeIdToString("0x1c", treeId, IModelApp.tileAdmin);
        expect(actualTreeIdStr).to.equal(expectedTreeIdStr);

        const treeProps = await imodel.tiles.getTileTreeProps(actualTreeIdStr);
        expect(treeProps.id).to.equal(actualTreeIdStr);

        const tree = await getTileTree(imodel, "0x1c", true, animationId);
        expect(tree.id).to.equal(actualTreeIdStr);
        expect(tree).not.to.equal(treeNoEdges);

        const tree2 = await getTileTree(imodel, "0x1c", true, animationId);
        expect(tree2).to.equal(tree);

        expect(await this.rootTileHasEdges(tree, imodel)).to.be.true;

        // Request without edges again.
        // We used to keep the old tree with edges around if you later requested it without - but that wastes memory.
        // Change in behavior potentially wastes time instead by reloading a tree without edges.
        const treeNoEdges3 = await getTileTree(imodel, "0x1c", false, animationId);
        expect(treeNoEdges3).not.to.equal(tree);
      }

      /* ###TODO rework this so it compiles again
      private static async testClassifierTree(imodel: IModelConnection, expectedTreeIdStr: string, treeId: IModelTile.ClassifierTreeId) {
        const actualTreeIdStr = iModelTileTreeIdToString("0x1c", treeId, IModelApp.tileAdmin);
        expect(actualTreeIdStr).to.equal(expectedTreeIdStr);

        const treeProps = await imodel.tiles.getTileTreeProps(actualTreeIdStr);
        expect(treeProps).not.to.be.undefined;
        expect(treeProps.id).to.equal(actualTreeIdStr);

        await imodel.models.load("0x1c");
        const model = imodel.models.getLoaded("0x1c") as GeometricModelState;
        expect(model).not.to.be.undefined;

        await waitUntil(() => {
          return TileTree.LoadStatus.Loaded === model.loadClassifierTileTree(treeId.type, treeId.expansion);
        });

        const tree = model.classifierTileTree;
        expect(tree).not.to.be.undefined;

        expect(tree!.id).to.equal(actualTreeIdStr);

        expect(await this.rootTileHasEdges(tree!, imodel)).to.be.false;
      }
      */

      private static async rootTileHasEdges(tree: TileTree, imodel: IModelConnection): Promise<boolean> {
        const response = await tree.loader.requestTileContent(tree.rootTile, () => false) as Uint8Array;
        expect(response).not.to.be.undefined;
        expect(response).instanceof(Uint8Array);

        const stream = new ByteStream(response.buffer);
        const reader = ImdlReader.create(stream, imodel, "0x1c", true, IModelApp.renderSystem)!;
        expect(reader).not.to.be.undefined;

        const meshes = (reader as any)._meshes;
        expect(meshes).not.to.be.undefined;
        for (const key of Object.keys(meshes)) {
          const mesh = meshes[key];
          for (const primitive of mesh.primitives)
            if (undefined !== primitive.edges)
              return true;
        }

        return false;
      }

      public static async test(imodel: IModelConnection) {
        await this.testPrimaryTree(imodel, "7_0-0x1c");

        // ###TODO: The tree Id is validated on back-end and rejected if the animation source Id does not identify an existing DisplayStyle with an attached schedule script.
        // Our test iModel lacks any such styles so test will fail.
        // await this.testPrimaryTree(imodel, "A:0x123_0x1c", "0x123");

        // ###TODO await this.testClassifierTree(imodel, "4_1-C:0.000000_0x1c", { type: BatchType.VolumeClassifier, expansion: 0.0 });
        // ###TODO await this.testClassifierTree(imodel, "4_0-CP:12.123457_0x1c", { type: BatchType.PlanarClassifier, expansion: 12.1234567 });
      }
    }

    // NB: We used to be able to configure TileAdmin to omit (or not omit) edges from requested tiles. That option was removed when we were satisfied with the feature.
    const myImodel = await App.start({});
    await App.test(myImodel);
    await App.stop();
  });

  it("should honor maximum major tile format version", async () => {
    class App extends TileAdminApp {
      public static async testMajorVersion(maximumMajorTileFormatVersion: number | undefined, expectedMajorVersion: number): Promise<void> {
        const imodel = await App.start({ maximumMajorTileFormatVersion });
        let treeId = "0x1c";
        if (undefined === maximumMajorTileFormatVersion || maximumMajorTileFormatVersion >= 4) {
          const v = undefined !== maximumMajorTileFormatVersion ? maximumMajorTileFormatVersion : CurrentImdlVersion.Major;
          treeId = v.toString() + "_0-0x1c";
        }

        const tree = await imodel.tiles.getTileTreeProps(treeId);

        expect(tree).not.to.be.undefined;
        expect(tree!.id).to.equal(treeId);
        expect(tree!.formatVersion).not.to.be.undefined;

        const majorVersion = (tree!.formatVersion!) >>> 0x10;
        expect(majorVersion).to.equal(expectedMajorVersion);

        // Old root content Id supplied strictly for very old front-ends - newer front-ends compute root content Id based on major version + flags
        expect(tree!.rootTile.contentId).to.equal("0/0/0/0/1");

        await App.stop();
      }
    }

    // Versions prior to 3 use old (un-versioned) Id format
    await App.testMajorVersion(3, 3);
    // Because of above, requesting a max version < 4 produces version 3
    await App.testMajorVersion(1, 3);
    // Request a specifc major version > 3
    await App.testMajorVersion(4, 4);
    // Request whatever the current major version is.
    // If the below test fails, we probably bumped current major version in native code and did not do so in typescript.
    await App.testMajorVersion(undefined, CurrentImdlVersion.Major);
  });
});
