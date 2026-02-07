' Elevate.vbs - Silent privilege elevation helper
' This VBS script elevates the batch file without password prompts or visible flashing

If WScript.Arguments.Count = 0 Then
    MsgBox "Usage: cscript elevate.vbs command"
    WScript.Quit 1
End If

' Get the command to run
strCommand = WScript.Arguments(0)

' Create shell object
Set objShell = CreateObject("Shell.Application")

' Extract the directory and file
strBatchFile = strCommand

' Execute with elevation (ShowWindow=1 means normal window)
objShell.ShellExecute "cmd.exe", "/c " & strBatchFile, "", "runas", 1

' Exit immediately (don't wait for the elevated process)
WScript.Quit 0
