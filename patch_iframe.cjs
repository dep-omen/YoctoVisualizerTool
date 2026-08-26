const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldTryBlock = `        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
        await processDirectoryHandle(dirHandle);
      } catch (err: any) {
        setIsScanning(false);
        setScanStatus(null);
        if (err.name === 'AbortError') return;
        console.error('Folder scan error:', err);
        if (err.name === 'SecurityError' || err.message?.includes('Cross-origin') || err.message?.includes('iframe')) {
          setErrorMessage('Security constraint: File System Picker is restricted inside embedded previews. Please launch this app in a dedicated browser tab or run in Electron.');
        } else {
          setErrorMessage(err.message || "Couldn't find build/conf/bblayers.conf");
        }
      }`;

const newTryBlock = `        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
        await processDirectoryHandle(dirHandle);
      } catch (err: any) {
        setIsScanning(false);
        setScanStatus(null);
        if (err.name === 'AbortError') return;
        console.error('Folder scan error:', err);
        if (err.name === 'SecurityError' || err.message?.includes('Cross-origin') || err.message?.includes('iframe') || err.message?.includes('Permissions-Policy')) {
          // Fallback for iframe restrictions
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        } else {
          setErrorMessage(err.message || "Couldn't find build/conf/bblayers.conf");
        }
      }`;

code = code.replace(oldTryBlock, newTryBlock);
fs.writeFileSync('src/App.tsx', code, 'utf8');
