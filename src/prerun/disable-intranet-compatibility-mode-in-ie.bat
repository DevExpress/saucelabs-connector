@echo off
REG ADD "HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\BrowserEmulation" /t REG_DWORD /v IntranetCompatibilityMode /d 0 /f