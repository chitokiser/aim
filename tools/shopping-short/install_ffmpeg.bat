@echo off
echo ========================================
echo  FFmpeg 자동 설치 (winget 사용)
echo ========================================

winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] FFmpeg 설치 완료!
    echo 터미널을 새로 열고 다시 실행하세요.
) else (
    echo.
    echo [실패] winget 설치 실패. 수동으로 설치하세요:
    echo   1. https://github.com/BtbN/FFmpeg-Builds/releases 에서 다운로드
    echo   2. ffmpeg-master-latest-win64-gpl.zip 압축 해제
    echo   3. bin 폴더 경로를 시스템 PATH에 추가
)
pause
