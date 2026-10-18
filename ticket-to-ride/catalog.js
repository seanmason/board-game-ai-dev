// First transcription from board pixels, 2026-10-18. Independent reconciliation pending.
export const EDITION = 'original-usa-30-tickets';
export const CATALOG_VERSION = 'usa-original-transcription-1';
export const COLORS = ['purple','blue','orange','white','green','yellow','black','red'];
export const TRAIN_COLORS = [...COLORS,'locomotive'];
export const ROUTE_POINTS = [0,1,2,4,7,10,15];
const cityRows = [
 ['vancouver','Vancouver',116,97],['calgary','Calgary',241,80],['winnipeg','Winnipeg',459,91],
 ['seattle','Seattle',112,145],['portland','Portland',91,189],['helena','Helena',337,195],
 ['duluth','Duluth',565,193],['sault','Sault Ste. Marie',685,136],['montreal','Montréal',869,77],
 ['boston','Boston',937,129],['toronto','Toronto',790,153],['new-york','New York',888,194],
 ['san-francisco','San Francisco',76,362],['salt-lake-city','Salt Lake City',269,304],
 ['omaha','Omaha',536,272],['chicago','Chicago',678,245],['pittsburgh','Pittsburgh',806,233],
 ['washington','Washington',895,271],['denver','Denver',395,331],['kansas-city','Kansas City',557,317],
 ['st-louis','St. Louis',638,318],['raleigh','Raleigh',839,330],['nashville','Nashville',725,350],
 ['las-vegas','Las Vegas',211,401],['santa-fe','Santa Fe',388,411],['oklahoma-city','Oklahoma City',536,390],
 ['little-rock','Little Rock',621,394],['atlanta','Atlanta',775,382],['charleston','Charleston',867,387],
 ['los-angeles','Los Angeles',149,453],['phoenix','Phoenix',264,459],['el-paso','El Paso',380,490],
 ['dallas','Dallas',557,468],['houston','Houston',594,502],['new-orleans','New Orleans',683,490],['miami','Miami',897,524]
];
export const CITIES = cityRows.map(([id,name,x,y])=>({id,name,x,y}));
export const CITY_BY_ID = Object.assign(Object.create(null),Object.fromEntries(CITIES.map(c=>[c.id,c])));
const laneRows = [
 ['vancouver','seattle',1,'gray','gray'],['vancouver','calgary',3,'gray'],
 ['calgary','winnipeg',6,'white'],['calgary','helena',4,'gray'],['calgary','seattle',4,'gray'],
 ['seattle','portland',1,'gray','gray'],['seattle','helena',6,'yellow'],
 ['portland','san-francisco',5,'green','purple'],['portland','salt-lake-city',6,'blue'],
 ['san-francisco','los-angeles',3,'yellow','purple'],['san-francisco','salt-lake-city',5,'orange','white'],
 ['los-angeles','las-vegas',2,'gray'],['los-angeles','phoenix',3,'gray'],['los-angeles','el-paso',6,'black'],
 ['las-vegas','salt-lake-city',3,'orange'],['salt-lake-city','helena',3,'purple'],['salt-lake-city','denver',3,'red','yellow'],
 ['helena','winnipeg',4,'blue'],['helena','duluth',6,'orange'],['helena','omaha',5,'red'],['helena','denver',4,'green'],
 ['winnipeg','duluth',4,'black'],['winnipeg','sault',6,'gray'],
 ['duluth','sault',3,'gray'],['duluth','toronto',6,'purple'],['duluth','chicago',3,'red'],['duluth','omaha',2,'gray','gray'],
 ['sault','montreal',5,'black'],['sault','toronto',2,'gray'],['montreal','boston',2,'gray','gray'],
 ['montreal','new-york',3,'blue'],['montreal','toronto',3,'gray'],['boston','new-york',2,'yellow','red'],
 ['new-york','pittsburgh',2,'white','green'],['new-york','washington',2,'orange','black'],
 ['toronto','pittsburgh',2,'gray'],['toronto','chicago',4,'white'],['chicago','pittsburgh',3,'orange','black'],
 ['chicago','st-louis',2,'green','white'],['chicago','omaha',4,'blue'],
 ['pittsburgh','st-louis',5,'green'],['pittsburgh','nashville',4,'yellow'],['pittsburgh','raleigh',2,'gray'],['pittsburgh','washington',2,'gray'],
 ['washington','raleigh',2,'gray','gray'],['raleigh','charleston',2,'gray'],['raleigh','atlanta',2,'gray','gray'],['raleigh','nashville',3,'black'],
 ['charleston','atlanta',2,'gray'],['charleston','miami',4,'purple'],
 ['atlanta','nashville',1,'gray'],['atlanta','new-orleans',4,'yellow','orange'],['atlanta','miami',5,'blue'],
 ['nashville','st-louis',2,'gray'],['nashville','little-rock',3,'white'],
 ['st-louis','kansas-city',2,'blue','purple'],['st-louis','little-rock',2,'gray'],
 ['omaha','kansas-city',1,'gray','gray'],['omaha','denver',4,'purple'],
 ['denver','kansas-city',4,'black','orange'],['denver','oklahoma-city',4,'red'],['denver','santa-fe',2,'gray'],['denver','phoenix',5,'white'],
 ['santa-fe','phoenix',3,'gray'],['santa-fe','el-paso',2,'gray'],['santa-fe','oklahoma-city',3,'blue'],['phoenix','el-paso',3,'gray'],
 ['el-paso','oklahoma-city',5,'yellow'],['el-paso','dallas',4,'red'],['el-paso','houston',6,'green'],
 ['oklahoma-city','kansas-city',2,'gray','gray'],['oklahoma-city','little-rock',2,'gray'],['oklahoma-city','dallas',2,'gray','gray'],
 ['dallas','little-rock',2,'gray'],['dallas','houston',1,'gray','gray'],['little-rock','new-orleans',3,'green'],
 ['houston','new-orleans',2,'gray'],['new-orleans','miami',6,'red']
];
export const ROUTES = laneRows.flatMap(([a,b,length,...colors])=>colors.map((color,i)=>({
 id:`${[a,b].sort().join('--')}-${i+1}`,a,b,length,color,
 parallelGroup: colors.length>1?[a,b].sort().join('--'):null,
 source:'board-9e99fa22', sourceLocation:`${CITY_BY_ID[a].name} ↔ ${CITY_BY_ID[b].name}, ${color}, lane ${i+1}`
})));
export const ROUTE_BY_ID = Object.assign(Object.create(null),Object.fromEntries(ROUTES.map(r=>[r.id,r])));
// Coordinator pixel transcription, provisional: author has not independently viewed all faces.
const ticketRows=[
 ['denver','el-paso',4],['kansas-city','houston',5],['new-york','atlanta',6],
 ['calgary','salt-lake-city',7],['chicago','new-orleans',7],['duluth','houston',8],
 ['helena','los-angeles',8],['sault','nashville',8],['seattle','los-angeles',9],
 ['montreal','atlanta',9],['sault','oklahoma-city',9],['chicago','santa-fe',9],
 ['toronto','miami',10],['duluth','el-paso',10],['portland','phoenix',11],
 ['winnipeg','little-rock',11],['denver','pittsburgh',11],['dallas','new-york',11],
 ['winnipeg','houston',12],['boston','miami',12],['vancouver','santa-fe',13],
 ['montreal','new-orleans',13],['calgary','phoenix',13],['los-angeles','chicago',16],
 ['san-francisco','atlanta',17],['portland','nashville',17],['los-angeles','miami',20],
 ['vancouver','montreal',20],['los-angeles','new-york',21],['seattle','new-york',22]
];
export const TICKETS = ticketRows.map(([a,b,value],i)=>({id:`ticket-${i+1}`,a,b,value,
 source:'coordinator-ticket-photo-transcription',sourceLocation:`${CITY_BY_ID[a].name} ↔ ${CITY_BY_ID[b].name}, ${value}`}));
export const TICKET_BY_ID = Object.assign(Object.create(null),Object.fromEntries(TICKETS.map(t=>[t.id,t])));
export const CATALOG_GATES = {boardTranscribed:true,boardReconciled:true,ticketsTranscribed:true,ticketsIndependentlyReconciled:false};
