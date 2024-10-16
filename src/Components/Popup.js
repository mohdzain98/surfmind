import React, { useEffect, useState } from 'react';

const Popup = (props) => {
  const {host} = props.prop
  const [query, setQuery] = useState('');
  const [head, setHead] = useState("")
  const [results, setResults] = useState({url:"",date:""});
  const [loader, setLoader] = useState("")
  const [disable, setDisable] = useState(false)
  const [noti, setNoti] = useState("")
  const [data, setData] = useState("")

  useEffect(()=>{
    async function getData(){
      const result = await chrome.storage.local.get({ navigationData: [] });
      setData(result)
    }
    getData()
    // eslint-disable-next-line
  },[])


  const handleSearch = async(e) => {
    e.preventDefault()
    setLoader("spinner-border spinner-border-sm mx-2")
    setHead("")
    setResults({url:"",date:""})
    setDisable(true)
    setNoti("processing data...")
    const dataa = data.navigationData;
    if(dataa && dataa.length > 0){
      setNoti("Awaiting AI response")
      try{
          const response  = await fetch(`${host}/search`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({data:dataa, query: query })
            })
            const data = await response.json()
            setHead(data.result)
            setResults({url:data.format.url, date:data.format.date})
            setNoti("")
            setLoader("")
            setDisable(false)
            
      }catch(err){
          setNoti('there is a problem generating response')
          setLoader("")
          setDisable(false)
      }
    }else{
      setLoader("")
      setNoti("There is no data in History")
      setDisable(false)
    }
  };

  return (
    <div className='container p-4' style={{width:'350px'}}>
        <form onSubmit={handleSearch}>
            <div class="mb-3">
                <label for="exampleInput" class="form-label text-muted" style={{fontSize:'14px'}}>Search Your History</label>
                <input type="text" class="form-control" id="exampleInput" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"aria-describedby="textHelp"/>
                <div id="textHelp" class="form-text">Type Keywords for better results</div>
            </div>
            <button type="submit" class="btn btn-warning btn-sm" style={{width:'70px',borderRadius:'10px'}} disabled={disable}>
              Search</button>
              <span className={loader}></span>
        </form>
      <p className='m-2' style={{fontSize:'12px'}}>{noti}</p>
      <div className='mt-4'>
        <div>
          <p style={{fontSize:'14px'}}>{head}</p>
          <p style={{fontSize:'14px', marginBottom:'-1%'}}>{results.date}</p>
          <a href={`${results.url}`}>{results.url}</a>
        </div>
      </div>
    </div>
  );
};

export default Popup;
