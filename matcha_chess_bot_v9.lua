--[[
    Chess Bot v9 — Cookie Development Chess (Matcha compatible)
    Executor: Matcha | Engine: Stockfish Online
    CONTROLS: F1 = show/hide

    v9 fixes:
    - Added resilient HTTP adapter for Matcha (`request`/`http_request`/`syn.request`/`game:HttpGet`)
    - Forward-declared `botLoop` to avoid nil callback timing issues
    - Safer Drawing object creation (pcall wrapped)
    - Better Stockfish response parsing (`bestmove e2e4`, JSON variants)
    - Minor board + piece detection robustness improvements
]]

local Players          = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService       = game:GetService("RunService")
local HttpService      = game:GetService("HttpService")
local LocalPlayer      = Players.LocalPlayer
local PlayerGui        = LocalPlayer:WaitForChild("PlayerGui")
local Mouse            = LocalPlayer:GetMouse()

local botLoop -- forward declaration

local CFG = {
    StockfishURL = "https://stockfish.online/api/s/v2.php",
    Depth        = 12,
    PollInterval = 1.2,
    GX = 20, GY = 20, GW = 310,
}

local State = {
    Running     = false,
    MyColor     = nil,
    SquareParts = {},
    BestMove    = nil,
    Visible     = true,
}

local function log(msg) print("[ChessBot] " .. tostring(msg)) end
local function randomDelay() task.wait(1 + math.random()) end

local function rawRequest(url)
    local req = rawget(getgenv(), "request") or rawget(getgenv(), "http_request")
    if not req and syn and syn.request then req = syn.request end

    if req then
        local ok, res = pcall(function()
            return req({ Url = url, Method = "GET" })
        end)
        if ok and res then
            if res.Success == false then return nil end
            return res.Body or res.body
        end
    end

    local ok, body = pcall(function() return game:HttpGet(url) end)
    if ok then return body end
    return nil
end

local function jsonDecode(str)
    local ok, r = pcall(function() return HttpService:JSONDecode(str) end)
    return ok and r or nil
end

local function extractBestMove(body)
    if type(body) ~= "string" then return nil end

    local parsed = jsonDecode(body)
    if parsed then
        local candidates = {
            parsed.bestmove,
            parsed.best_move,
            parsed.move,
            parsed.data and parsed.data.bestmove,
            parsed.data and parsed.data.best_move,
        }
        for _, c in ipairs(candidates) do
            if type(c) == "string" then
                local mv = c:match("([a-h][1-8][a-h][1-8][qrbn]?)")
                if mv then return mv end
            end
        end
    end

    return body:match("bestmove%s+([a-h][1-8][a-h][1-8][qrbn]?)")
        or body:match("([a-h][1-8][a-h][1-8][qrbn]?)")
end

local function newSquare(x, y, w, h, color, filled, thickness)
    local ok, s = pcall(function() return Drawing.new("Square") end)
    if not ok or not s then return nil end
    s.Position  = Vector2.new(x, y)
    s.Size      = Vector2.new(w, h)
    s.Color     = color
    s.Filled    = filled ~= false
    s.Thickness = (filled == false) and (thickness or 1) or 0
    s.Transparency = 1
    s.Visible   = true
    return s
end

local function newText(str, x, y, color, size)
    local ok, t = pcall(function() return Drawing.new("Text") end)
    if not ok or not t then return nil end
    t.Text         = str
    t.Position     = Vector2.new(x, y)
    t.Color        = color or Color3.new(1,1,1)
    t.Size         = size  or 15
    t.Transparency = 1
    t.Visible      = true
    return t
end

local C = {
    bg      = Color3.fromRGB(14,14,14),
    title   = Color3.fromRGB(25,100,50),
    btnGo   = Color3.fromRGB(25,110,50),
    btnStop = Color3.fromRGB(140,28,28),
    btnDim  = Color3.fromRGB(48,48,48),
    btnHov  = Color3.fromRGB(72,72,72),
    border  = Color3.fromRGB(65,65,65),
    white   = Color3.new(1,1,1),
    dim     = Color3.fromRGB(125,125,125),
    green   = Color3.fromRGB(0,210,70),
    text    = Color3.fromRGB(200,200,200),
}

local GH, D, BTN = 178, {}, {}

local function makeGUI()
    local x, y, w = CFG.GX, CFG.GY, CFG.GW
    D.bg      = newSquare(x, y, w, GH, C.bg)
    D.border  = newSquare(x, y, w, GH, C.border, false)
    D.titleBg = newSquare(x, y, w, 34, C.title)

    D.titleTx  = newText("Chess Bot  |  Matcha  (F1 = hide)", x+8, y+10, C.white, 14)
    D.statusTx = newText("Stopped", x+8, y+40, C.text, 13)
    D.turnTx   = newText("Turn: --", x+8, y+60, C.dim, 13)
    D.moveTx   = newText("Best move: --", x+8, y+80, C.green, 14)
    D.depthTx  = newText("Depth: "..CFG.Depth, x+8, y+102, C.dim, 13)

    local dbx, dby, dbw, dbh = x+w-70, y+98, 28, 20
    D.dMinBg  = newSquare(dbx, dby, dbw, dbh, C.btnDim)
    D.dMinTx  = newText("-", dbx+9, dby+3, C.white, 15)
    BTN[1] = {x=dbx, y=dby, w=dbw, h=dbh, id="dMinus"}

    D.dPlusBg = newSquare(dbx+34, dby, dbw, dbh, C.btnDim)
    D.dPlusTx = newText("+", dbx+43, dby+3, C.white, 15)
    BTN[2] = {x=dbx+34, y=dby, w=dbw, h=dbh, id="dPlus"}

    D.divider = newSquare(x+8, y+126, w-16, 1, C.border)

    local bx, by, bw, bh = x+10, y+132, w-20, 36
    D.togBg  = newSquare(bx, by, bw, bh, C.btnGo)
    D.togTx  = newText("Start Bot", bx+bw/2-30, by+11, C.white, 14)
    BTN[3] = {x=bx, y=by, w=bw, h=bh, id="toggle"}

    log("GUI ready (v9)")
end

local function setVisible(v) State.Visible = v for _,obj in pairs(D) do pcall(function() if obj then obj.Visible=v end end) end end
local function setStatus(t) pcall(function() if D.statusTx then D.statusTx.Text=t end end) end

local function setTurnDisp(active, mine)
    if not D.turnTx then return end
    if not active then D.turnTx.Text="Turn: --" D.turnTx.Color=C.dim return end
    local who = active:sub(1,1):upper()..active:sub(2)
    if mine then D.turnTx.Text=">> YOUR TURN ("..who..")" D.turnTx.Color=C.green
    else D.turnTx.Text="Opponent ("..who..")" D.turnTx.Color=C.dim end
end

local function setMoveDisp(move)
    if not D.moveTx then return end
    if move then
        local promo=(#move==5) and (" ="..move:sub(5,5):upper()) or ""
        D.moveTx.Text="Best: "..move:sub(1,2):upper().." -> "..move:sub(3,4):upper()..promo
        D.moveTx.Color=C.green
    else D.moveTx.Text="Best move: --" D.moveTx.Color=C.dim end
end

local function setToggleDisp(on) pcall(function() if D.togBg then D.togBg.Color=on and C.btnStop or C.btnGo end if D.togTx then D.togTx.Text=on and "Stop Bot" or "Start Bot" end end) end
local function updateDepth() pcall(function() if D.depthTx then D.depthTx.Text="Depth: "..CFG.Depth end end) end
local function inRect(mx,my,r) return mx>=r.x and mx<=r.x+r.w and my>=r.y and my<=r.y+r.h end

local function handleClick(mx,my)
    for _,btn in ipairs(BTN) do
        if inRect(mx,my,btn) then
            if btn.id=="dMinus" then CFG.Depth=math.clamp(CFG.Depth-1,1,15) updateDepth()
            elseif btn.id=="dPlus" then CFG.Depth=math.clamp(CFG.Depth+1,1,15) updateDepth()
            elseif btn.id=="toggle" then
                State.Running = not State.Running
                setToggleDisp(State.Running)
                if State.Running then setStatus("Initialising...") task.spawn(function() if botLoop then botLoop() end end)
                else setStatus("Stopped") setMoveDisp(nil) setTurnDisp(nil,false) end
            end
            return
        end
    end
end

UserInputService.InputBegan:Connect(function(input, processed)
    if processed then return end
    if input.KeyCode == Enum.KeyCode.F1 then setVisible(not State.Visible) return end
    if input.UserInputType == Enum.UserInputType.MouseButton1 and State.Visible then handleClick(Mouse.X, Mouse.Y) end
end)

RunService.RenderStepped:Connect(function()
    if not State.Visible then return end
    local mx,my = Mouse.X, Mouse.Y
    pcall(function()
        if D.dMinBg and BTN[1] then D.dMinBg.Color = inRect(mx,my,BTN[1]) and C.btnHov or C.btnDim end
        if D.dPlusBg and BTN[2] then D.dPlusBg.Color = inRect(mx,my,BTN[2]) and C.btnHov or C.btnDim end
        local base = State.Running and C.btnStop or C.btnGo
        if D.togBg and BTN[3] then
            D.togBg.Color = inRect(mx,my,BTN[3]) and Color3.new(math.min(base.R+0.07,1),math.min(base.G+0.07,1),math.min(base.B+0.07,1)) or base
        end
    end)
end)

local FILES = {"a","b","c","d","e","f","g","h"}
local function isAlgebraic(name)
    if type(name)~="string" then return false end
    local l=name:lower()
    return #l==2 and l:sub(1,1):match("[a-h]") and l:sub(2,2):match("[1-8]")
end

local function findBoardModel()
    local function search(model,d)
        if d>7 then return nil end
        local n=0
        for _,c in ipairs(model:GetChildren()) do if c:IsA("BasePart") and isAlgebraic(c.Name) then n=n+1 end end
        if n>=32 then return model end
        for _,c in ipairs(model:GetChildren()) do
            if c:IsA("Model") or c:IsA("Folder") then local r=search(c,d+1) if r then return r end end
        end
        return nil
    end
    return search(workspace,0)
end

local function buildSquareMap(m)
    local map={}
    for _,p in ipairs(m:GetDescendants()) do if p:IsA("BasePart") and isAlgebraic(p.Name) then map[p.Name:lower()]=p end end
    return map
end

local FENL={ white={pawn="P",knight="N",bishop="B",rook="R",queen="Q",king="K"}, black={pawn="p",knight="n",bishop="b",rook="r",queen="q",king="k"} }

local function pieceFromName(name)
    local l=tostring(name):lower()
    local color = (l:find("white") or l:match("^w[%-%_]?")) and "white" or ((l:find("black") or l:match("^b[%-%_]?")) and "black" or nil)
    local ptype = l:find("pawn") and "pawn" or l:find("knight") and "knight" or l:find("queen") and "queen" or l:find("king") and "king" or l:find("rook") and "rook" or l:find("bishop") and "bishop" or nil
    return color,ptype
end

local function getPiece(sq)
    for _,child in ipairs(sq:GetChildren()) do
        local c,p = pieceFromName(child.Name)
        if c and p then return c,p end
        if child:IsA("Model") or child:IsA("Folder") then
            for _,sub in ipairs(child:GetDescendants()) do
                local c2,p2 = pieceFromName(sub.Name)
                if c2 and p2 then return c2,p2 end
            end
        end
    end
    return nil,nil
end

local function buildFEN(sqMap, active)
    local rows={}
    for rank=8,1,-1 do
        local row,empty="",0
        for file=1,8 do
            local part=sqMap[FILES[file]..rank]
            local c,p=part and getPiece(part)
            if c and p and FENL[c] and FENL[c][p] then if empty>0 then row=row..empty empty=0 end row=row..FENL[c][p] else empty=empty+1 end
        end
        if empty>0 then row=row..empty end
        table.insert(rows,row)
    end
    return table.concat(rows,"/").." "..(active or "w").." KQkq - 0 1"
end

local function detectMyColor()
    for _,attr in ipairs({"Color","Side","Team","ChessColor","PieceColor"}) do
        local v=LocalPlayer:GetAttribute(attr)
        if v then local l=tostring(v):lower() if l:find("white") then return "white" elseif l:find("black") then return "black" end end
    end
    for _,g in ipairs(PlayerGui:GetDescendants()) do
        if g:IsA("TextLabel") or g:IsA("TextButton") then
            local t=(g.Text or ""):lower()
            if t:find("you are white") or t:find("playing white") then return "white" end
            if t:find("you are black") or t:find("playing black") then return "black" end
        end
    end
    return "white"
end

local function detectActive()
    for _,g in ipairs(PlayerGui:GetDescendants()) do
        if g:IsA("TextLabel") or g:IsA("TextButton") then
            local t=(g.Text or ""):lower()
            if t:find("your turn") or t:find("white's turn") or t:find("white to move") then return "white" end
            if t:find("black's turn") or t:find("black to move") then return "black" end
        end
    end
    for _,attr in ipairs({"Turn","ActiveColor","CurrentTurn","ActivePlayer"}) do
        local v=LocalPlayer:GetAttribute(attr) or workspace:GetAttribute(attr)
        if v then local l=tostring(v):lower() if l:find("white") then return "white" elseif l:find("black") then return "black" end end
    end
    return nil
end

local function queryStockfish(fen, depth)
    local url = CFG.StockfishURL.."?fen="..HttpService:UrlEncode(fen).."&depth="..depth
    log("Querying Stockfish depth "..depth.."...")
    local body = rawRequest(url)
    if not body or #body == 0 then log("HTTP request failed"); return nil end
    local best = extractBestMove(body)
    if best then return best end
    log("Bad response: "..tostring(body):sub(1,120))
    return nil
end

botLoop = function()
    setStatus("Finding board...")
    local board = findBoardModel()
    if not board then setStatus("Board not found — start a match!") State.Running=false setToggleDisp(false) return end

    State.SquareParts = buildSquareMap(board)
    local n=0 for _ in pairs(State.SquareParts) do n=n+1 end
    log("Board: "..board:GetFullName().." ("..n.." squares)")

    State.MyColor = detectMyColor()
    log("Color: "..State.MyColor)
    setStatus("Ready — "..(State.MyColor:sub(1,1):upper()..State.MyColor:sub(2)))

    local lastFEN=""
    while State.Running do
        local active = detectActive()
        local mine   = (active == State.MyColor)
        setTurnDisp(active, mine)

        if mine then
            local fen = buildFEN(State.SquareParts, active and active:sub(1,1) or "w")
            if fen ~= lastFEN then
                lastFEN = fen
                setStatus("Thinking (depth "..CFG.Depth..")...")
                randomDelay()
                if not State.Running then break end
                local best = queryStockfish(fen, CFG.Depth)
                State.BestMove = best
                if best then setMoveDisp(best) setStatus("Your turn — move shown above!") log("Best: "..best)
                else setMoveDisp(nil) setStatus("No move — check internet") end
            end
        else
            if State.BestMove then State.BestMove=nil setMoveDisp(nil) end
            setStatus("Waiting for opponent...")
        end
        task.wait(CFG.PollInterval)
    end
    setMoveDisp(nil)
    log("Stopped.")
end

makeGUI()
log("v9 ready — F1 to toggle, click Start Bot.")
