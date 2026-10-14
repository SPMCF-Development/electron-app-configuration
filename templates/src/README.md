# Electron Processes

This folder contains the following:
- `main/index.ts` - primary script for the main process (see [dialog](https://www.electronjs.org/docs/latest/api/dialog))
- `main/python.ts` - executes the Python bridge script as a child subprocess
- `preload/index.ts` - exposes a controlled, safe set of capabilities to the GUI before it loads
- `preload/index.d.ts` - tells the renderer about the globals that were added in the preload script
- `renderer/src/App.tsx` - main rendering script for the GUI; includes React code
- `renderer/src/components`
	- `EditableTable.tsx` - custom component for interactive table
	- `FileDropZone.tsx` - custom component for file drop zone
	- `IntField.tsx` - custom component for integer-only field
	- `Step.tsx` - custom component for marking sections in GUI
	- `tableTypes.ts` - types and functions necessary for `EditableTable.tsx`
- `shared/types.ts` - types shared by all processes
- `shared/validate.ts` - validation script for validating user inputs relative to main Python script
