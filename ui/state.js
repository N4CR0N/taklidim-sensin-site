// Arayüz durumu: kurulum taslakları, oyun, geçici seçimler. Oyun kuralları burada değil, engine/'da.
                                               
                                                   
                                                         
                                                                 
import { CLASSIC } from '../data/classic.js';
import { QUICK } from '../data/quick.js';
                                                  
                                          

                                                                                                                                               
                                                                                                                                

/** Online oyunda bu telefonun durumu. `room` sunucudan gelen (süzülmüş) son durumdur. */
                           
                        
                    
                                                           
                       
                                                                                             
                         
                     
                                                                                                                                 
                           
                  
                    
                
 

                     
             
                  
                    
                    
                       
                       
               
                    
                  
                    
                 
                  
                     
                       
                     
                                     
                          
                                       
 

export const CLASSIC_BY_ID                              = Object.fromEntries(CLASSIC.map((c) => [c.id, c]));
export const QUICK_BY_ID                            = Object.fromEntries(QUICK.map((c) => [c.id, c]));

export function defaultTeamSetup()            {
  return {
    teams: [
      { name: 'Takım A', players: ['', ''] },
      { name: 'Takım B', players: ['', ''] },
    ],
    settings: { roleSelect: 'wheel', levelMode: 'ladder', length: 'fast', freeTurns: 3, timing: 'timed' },
  };
}

export function defaultQuickSetup()             {
  return { relation: 'arkadas', imitation: true, durationSec: 30, names: ['', ''], parentIndex: 0 };
}

export function initialUI()     {
  return {
    view: 'menu',
    team: defaultTeamSetup(),
    quick: defaultQuickSetup(),
    game: null,
    score: null,
    guess: null,
    sheet: null,
    wheelFrom: 0,
    wheelTo: 0,
    spinUntil: 0,
    prepAt: 0,
    warned: false,
    twistOpen: false,
    error: null,
    hideNames: false,
    goldenPick: {},
    online: null,
    form: { name: '', code: '' },
  };
}
