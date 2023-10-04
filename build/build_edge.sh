#!/bin/bash

pushd .. > /dev/null

rm -rf dist
rm -f availablereads-edge.zip

mkdir dist
cp -r src dist/
cp -r icons dist/
cp build/manifest.json.edge dist/manifest.json

pushd dist > /dev/null
zip ../availablereads-edge.zip -qr *
popd > /dev/null

popd > /dev/null