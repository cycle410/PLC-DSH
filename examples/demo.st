TYPE ST_Demo :
STRUCT
    Value : INT;
    Valid : BOOL;
END_STRUCT
END_TYPE

FUNCTION_BLOCK FB_Demo
VAR_INPUT
    Start : BOOL;
    Setpoint : INT;
END_VAR
VAR_OUTPUT
    Done : BOOL;
    Actual : INT;
END_VAR
VAR
    Timer : TON;
END_VAR

IF Start THEN
    Actual := Setpoint;
    Timer(IN := TRUE, PT := T#100MS);
    Done := Timer.Q;
ELSE
    Done := FALSE;
END_IF;

END_FUNCTION_BLOCK

PROGRAM PRG_Demo
VAR
    Counter : INT;
END_VAR

Counter := Counter + 1;

END_PROGRAM
