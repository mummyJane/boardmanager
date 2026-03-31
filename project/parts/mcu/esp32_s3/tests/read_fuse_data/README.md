# ESP32-S3 eFuse Read Test

This is a host-side module test.

It uses `espefuse.py` to read the attached ESP32-S3 eFuse summary with a bounded timeout.

Example:

```powershell
.\run.ps1 -Port COM4 -TimeoutSeconds 30
```
