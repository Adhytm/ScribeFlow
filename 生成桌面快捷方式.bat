@echo off
chcp 65001 >nul
title 生成 ScribeFlow 桌面快捷方式

cd /d "%~dp0"

echo 正在创建桌面快捷方式...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$w = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop'); $s = $w.CreateShortcut((Join-Path $d 'ScribeFlow文案工具.lnk')); $s.TargetPath = (Join-Path (Get-Location) '一键启动.bat'); $s.WorkingDirectory = (Get-Location).Path; $s.Description = 'ScribeFlow 一键文案撰写工具'; $s.Save()"

if exist "%USERPROFILE%\Desktop\ScribeFlow文案工具.lnk" (
    echo.
    echo =======================================================
    echo  [成功] 已在你的桌面上生成快捷方式：“ScribeFlow文案工具”！
    echo  以后随时双击桌面图标，就能一秒打开网页工作台。
    echo =======================================================
) else (
    echo.
    echo [提示] 快捷方式生成失败，你可以直接双击本文件夹内的“一键启动.bat”。
)

echo.
pause
